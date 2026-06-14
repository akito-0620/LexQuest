import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { QUEST_BY_SLUG } from "@/lib/quest-engine";
import { safeJsonArray } from "@/lib/session-summary";
import { unlockVocabFromAi } from "@/lib/ai-unlock";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const scenarioSlug = typeof body.scenarioSlug === "string" ? body.scenarioSlug : null;
  if (!scenarioSlug) {
    return NextResponse.json({ error: "scenarioSlug required" }, { status: 400 });
  }

  const user = await getOrCreateDefaultUser();
  const scenario = await prisma.scenario.findUnique({ where: { slug: scenarioSlug } });
  if (!scenario) {
    return NextResponse.json({ error: "scenario not found" }, { status: 404 });
  }

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      scenarioId: scenario.id,
    },
  });

  // Assign session quests from scenario.recommendedQuestSlugs
  const slugs = safeJsonArray(scenario.recommendedQuestSlugs);
  const quests = await prisma.quest.findMany({ where: { slug: { in: slugs }, active: true } });
  for (const q of quests) {
    await prisma.sessionQuest.create({
      data: { sessionId: session.id, questId: q.id },
    });
  }

  // Opening assistant message
  const opening = scenario.openingLine;
  await prisma.message.create({
    data: { sessionId: session.id, role: "assistant", content: opening },
  });
  await unlockVocabFromAi(user.id, opening);

  return NextResponse.json({
    sessionId: session.id,
    scenarioSlug: scenario.slug,
    scenarioName: scenario.name,
    openingMessage: opening,
    quests: quests
      .map((q) => {
        const def = QUEST_BY_SLUG.get(q.slug);
        return def
          ? {
              slug: q.slug,
              title: q.title,
              description: q.description,
              type: q.type,
              target:
                def.target.kind === "continuation"
                  ? def.target.userTurns
                  : def.target.kind === "function" || def.target.kind === "new"
                    ? (def.target as { count: number }).count
                    : 1,
              progress: 0,
              completed: false,
              rewardXp: q.rewardXp,
            }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null),
  });
}
