import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { QUEST_BY_SLUG, evaluateQuest, emptySessionState } from "@/lib/quest-engine";
import { safeJsonArray } from "@/lib/session-summary";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: "asc" } },
      quests: { include: { quest: true } },
      usages: { include: { vocabularyItem: true } },
    },
  });
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Recompute quest state
  const state = emptySessionState();
  state.userTurns = session.messages.filter((m) => m.role === "user").length;
  for (const u of session.usages) {
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

  const quests = session.quests.map((sq) => {
    const def = QUEST_BY_SLUG.get(sq.quest.slug);
    const result = def ? evaluateQuest(def, state) : { progress: 0, target: 1, completed: false };
    return {
      slug: sq.quest.slug,
      title: sq.quest.title,
      description: sq.quest.description,
      type: sq.quest.type,
      target: result.target,
      progress: result.progress,
      completed: result.completed,
      rewardXp: sq.quest.rewardXp,
    };
  });

  return NextResponse.json({
    id: session.id,
    scenario: {
      slug: session.scenario.slug,
      name: session.scenario.name,
      description: session.scenario.description,
      goal: session.scenario.goal,
      focusFunctions: safeJsonArray(session.scenario.focusFunctions),
    },
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    totalTurns: state.userTurns,
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
    quests,
  });
}
