import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractVocabulary } from "@/lib/vocabulary-extractor";
import {
  computeAward,
  levelFromXp,
  classifyStatus,
} from "@/lib/xp";
import {
  QUEST_BY_SLUG,
  evaluateQuest,
  emptySessionState,
  questBonusApplicable,
} from "@/lib/quest-engine";
import { safeJsonArray } from "@/lib/session-summary";
import { generateAIResponse } from "@/lib/ai";
import { unlockVocabFromAi } from "@/lib/ai-unlock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: "asc" } },
      usages: { include: { vocabularyItem: true } },
      quests: { include: { quest: true } },
    },
  });
  if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });
  if (session.endedAt) {
    return NextResponse.json({ error: "session already ended" }, { status: 400 });
  }

  const focusFunctions = safeJsonArray(session.scenario.focusFunctions);
  const activeQuests = session.quests
    .filter((sq) => sq.status === "active")
    .map((sq) => {
      const def = QUEST_BY_SLUG.get(sq.quest.slug);
      return def ? { sq, def } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  // Save the user message
  const userMsg = await prisma.message.create({
    data: { sessionId: session.id, role: "user", content },
  });

  // Extract vocabulary
  const extracted = extractVocabulary(content);

  // Build prior state for bonus calculations
  const priorMeaningGroups = new Set<string>();
  const priorSessionUsageByKey = new Map<string, number>();
  for (const u of session.usages) {
    if (u.vocabularyItem.meaningGroup) priorMeaningGroups.add(u.vocabularyItem.meaningGroup);
    priorSessionUsageByKey.set(
      u.vocabularyItem.normalizedText,
      (priorSessionUsageByKey.get(u.vocabularyItem.normalizedText) ?? 0) + 1,
    );
  }

  const turnMeaningGroupsSeen = new Set<string>(priorMeaningGroups);
  const turnSessionUsage = new Map<string, number>(priorSessionUsageByKey);

  interface TurnItem {
    displayText: string;
    category: string;
    isNew: boolean;
    leveledUp: boolean;
    newLevel: number;
    xpAwarded: number;
    meaningGroup?: string | null;
    functionType?: string | null;
  }
  const turnItems: TurnItem[] = [];
  let totalXpGained = 0;

  for (const v of extracted) {
    // Ensure VocabularyItem exists
    let item = await prisma.vocabularyItem.findUnique({
      where: { normalizedText: v.normalizedText },
    });
    if (!item) {
      item = await prisma.vocabularyItem.create({
        data: {
          normalizedText: v.normalizedText,
          displayText: v.displayText,
          category: v.category,
          meaningGroup: v.meaningGroup ?? null,
          functionType: v.functionType ?? null,
          alternatives: JSON.stringify(v.alternatives ?? []),
        },
      });
    }

    const existing = await prisma.userVocabulary.findUnique({
      where: {
        userId_vocabularyItemId: { userId: session.userId, vocabularyItemId: item.id },
      },
    });
    const isFirstEverUse = !existing || existing.totalCount === 0;

    const sessionCount = (turnSessionUsage.get(v.normalizedText) ?? 0) + 1;
    turnSessionUsage.set(v.normalizedText, sessionCount);

    const meaningGroupUsedBefore = v.meaningGroup ? turnMeaningGroupsSeen.has(v.meaningGroup) : false;
    if (v.meaningGroup) turnMeaningGroupsSeen.add(v.meaningGroup);

    const fitsContext = v.functionType ? focusFunctions.includes(v.functionType) : false;

    const satisfiesQuest = activeQuests.some(({ def }) =>
      questBonusApplicable(def, v, isFirstEverUse),
    );

    const award = computeAward({
      isFirstEverUse,
      meaningGroupUsedBeforeInSession: meaningGroupUsedBefore,
      satisfiesActiveQuest: satisfiesQuest,
      fitsScenarioContext: fitsContext,
      sessionUsageCount: sessionCount,
      itemCategory: v.category,
      hasMeaningGroup: !!v.meaningGroup,
    });
    totalXpGained += award.totalXp;

    const prevLevel = existing?.level ?? 1;
    const newXp = (existing?.xp ?? 0) + award.totalXp;
    const newLevel = levelFromXp(newXp);
    const leveledUp = newLevel > prevLevel;
    const newTotalCount = (existing?.totalCount ?? 0) + 1;

    // Compute a rough varietyRatio for status (how much of recent user history sat in this meaning group).
    let varietyRatio = 0;
    if (v.meaningGroup) {
      const groupMembers = await prisma.vocabularyItem.findMany({
        where: { meaningGroup: v.meaningGroup },
        select: { id: true, normalizedText: true },
      });
      const ids = groupMembers.map((g) => g.id);
      if (ids.length > 0) {
        const totalGroupCount = await prisma.userVocabulary.findMany({
          where: { userId: session.userId, vocabularyItemId: { in: ids } },
          select: { vocabularyItemId: true, totalCount: true },
        });
        const sum = totalGroupCount.reduce((acc, u) => acc + u.totalCount, 0);
        if (sum > 0) varietyRatio = newTotalCount / sum;
      }
    }

    const status = classifyStatus({
      level: newLevel,
      totalCount: newTotalCount,
      hasMeaningGroup: !!v.meaningGroup,
      varietyRatio,
    });

    if (existing) {
      await prisma.userVocabulary.update({
        where: { id: existing.id },
        data: {
          xp: newXp,
          level: newLevel,
          totalCount: newTotalCount,
          lastUsedAt: new Date(),
          status,
        },
      });
    } else {
      await prisma.userVocabulary.create({
        data: {
          userId: session.userId,
          vocabularyItemId: item.id,
          xp: newXp,
          level: newLevel,
          totalCount: 1,
          firstUsedAt: new Date(),
          lastUsedAt: new Date(),
          status,
        },
      });
    }

    await prisma.vocabularyUsage.create({
      data: {
        sessionId: session.id,
        userId: session.userId,
        vocabularyItemId: item.id,
        messageId: userMsg.id,
        xpAwarded: award.totalXp,
        isNew: isFirstEverUse,
        leveledUp,
      },
    });

    turnItems.push({
      displayText: item.displayText,
      category: item.category,
      isNew: isFirstEverUse,
      leveledUp,
      newLevel,
      xpAwarded: award.totalXp,
      meaningGroup: v.meaningGroup ?? null,
      functionType: v.functionType ?? null,
    });
  }

  // Re-evaluate quest progress against the full updated session
  const updatedUsages = await prisma.vocabularyUsage.findMany({
    where: { sessionId: session.id },
    include: { vocabularyItem: true },
  });
  const turnCount = await prisma.message.count({
    where: { sessionId: session.id, role: "user" },
  });
  const state = emptySessionState();
  state.userTurns = turnCount;
  for (const u of updatedUsages) {
    state.keysUsed.add(u.vocabularyItem.normalizedText);
    if (u.isNew) state.newKeysUsed.add(u.vocabularyItem.normalizedText);
    if (u.vocabularyItem.meaningGroup) {
      if (!state.meaningGroupMembers.has(u.vocabularyItem.meaningGroup)) {
        state.meaningGroupMembers.set(u.vocabularyItem.meaningGroup, new Set());
      }
      state.meaningGroupMembers
        .get(u.vocabularyItem.meaningGroup)!
        .add(u.vocabularyItem.normalizedText);
    }
    if (u.vocabularyItem.functionType) {
      state.functionTypeCounts.set(
        u.vocabularyItem.functionType,
        (state.functionTypeCounts.get(u.vocabularyItem.functionType) ?? 0) + 1,
      );
    }
  }

  const questResults = [];
  for (const sq of session.quests) {
    const def = QUEST_BY_SLUG.get(sq.quest.slug);
    if (!def) continue;
    const result = evaluateQuest(def, state);
    const newStatus = result.completed && sq.status === "active" ? "completed" : sq.status;
    if (result.progress !== sq.progress || newStatus !== sq.status) {
      await prisma.sessionQuest.update({
        where: { id: sq.id },
        data: { progress: result.progress, status: newStatus },
      });
    }
    questResults.push({
      slug: sq.quest.slug,
      title: sq.quest.title,
      description: sq.quest.description,
      type: sq.quest.type,
      progress: result.progress,
      target: result.target,
      completed: result.completed,
      rewardXp: sq.quest.rewardXp,
    });
  }

  // Generate AI reply using history INCLUDING this new user message
  const history = [
    ...session.messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];
  const aiReply = await generateAIResponse(session.scenario.slug, history);
  const aiMsg = await prisma.message.create({
    data: { sessionId: session.id, role: "assistant", content: aiReply },
  });

  // Unlock codex entries from the AI's reply WITHOUT awarding XP or incrementing user usage.
  await unlockVocabFromAi(session.userId, aiReply);

  await prisma.session.update({
    where: { id: session.id },
    data: { totalTurns: turnCount },
  });

  return NextResponse.json({
    userMessage: { id: userMsg.id, role: "user", content, createdAt: userMsg.createdAt },
    assistantMessage: {
      id: aiMsg.id,
      role: "assistant",
      content: aiReply,
      createdAt: aiMsg.createdAt,
    },
    turn: {
      turnCount,
      totalXpGained,
      items: turnItems,
    },
    quests: questResults,
  });
}
