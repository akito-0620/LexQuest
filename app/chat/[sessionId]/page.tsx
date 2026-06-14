import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { safeJsonArray } from "@/lib/session-summary";
import { QUEST_BY_SLUG, evaluateQuest, emptySessionState } from "@/lib/quest-engine";
import { FUNCTION_LABELS } from "@/lib/vocabulary-dictionary";
import ChatView from "./ChatView";

export const dynamic = "force-dynamic";

export default async function ChatPage({ params }: { params: { sessionId: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.sessionId },
    include: {
      scenario: true,
      messages: { orderBy: { createdAt: "asc" } },
      quests: { include: { quest: true } },
      usages: { include: { vocabularyItem: true } },
    },
  });
  if (!session) notFound();

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

  const questsInit = session.quests.map((sq) => {
    const def = QUEST_BY_SLUG.get(sq.quest.slug);
    const result = def ? evaluateQuest(def, state) : { progress: 0, target: 1, completed: false };
    return {
      slug: sq.quest.slug,
      title: sq.quest.title,
      description: sq.quest.description,
      type: sq.quest.type,
      progress: result.progress,
      target: result.target,
      completed: result.completed,
      rewardXp: sq.quest.rewardXp,
    };
  });

  const focusFunctions = safeJsonArray(session.scenario.focusFunctions).map((f) => ({
    slug: f,
    label: FUNCTION_LABELS[f]?.ja ?? f,
  }));

  return (
    <ChatView
      sessionId={session.id}
      scenario={{
        slug: session.scenario.slug,
        name: session.scenario.name,
        description: session.scenario.description,
        goal: session.scenario.goal,
        focusFunctions,
      }}
      initialMessages={session.messages.map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }))}
      initialQuests={questsInit}
      ended={session.endedAt != null}
    />
  );
}
