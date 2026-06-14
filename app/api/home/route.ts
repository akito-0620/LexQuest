import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { playerProgress } from "@/lib/xp";
import { safeJsonArray } from "@/lib/session-summary";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getOrCreateDefaultUser();

  const recent = await prisma.userVocabulary.findMany({
    where: { userId: user.id },
    orderBy: { firstUsedAt: "desc" },
    take: 5,
    include: { vocabularyItem: true },
  });

  const top = await prisma.userVocabulary.findMany({
    where: { userId: user.id },
    orderBy: [{ totalCount: "desc" }, { lastUsedAt: "desc" }],
    take: 3,
    include: { vocabularyItem: true },
  });

  const recentSessions = await prisma.session.findMany({
    where: { userId: user.id, endedAt: { not: null } },
    orderBy: { endedAt: "desc" },
    take: 3,
    include: { scenario: true },
  });

  const totalVocab = await prisma.userVocabulary.count({ where: { userId: user.id } });
  const progress = playerProgress(user.playerXp);

  // Today's suggested quests: pick 3 quests the user has never completed
  // (or all of them if the user is new)
  const completedSlugs = new Set(
    (
      await prisma.userQuest.findMany({
        where: { userId: user.id, status: "completed" },
        include: { quest: true },
      })
    ).map((uq) => uq.quest.slug),
  );
  const allQuests = await prisma.quest.findMany({ where: { active: true } });
  const pool = allQuests.filter((q) => !completedSlugs.has(q.slug));
  const todaysQuests = (pool.length > 0 ? pool : allQuests).slice(0, 3).map((q) => ({
    slug: q.slug,
    title: q.title,
    description: q.description,
    rewardXp: q.rewardXp,
  }));

  return NextResponse.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      level: user.playerLevel,
      xp: user.playerXp,
      progress,
    },
    totals: {
      totalVocab,
    },
    recentlyLearned: recent.map((uv) => ({
      key: uv.vocabularyItem.normalizedText,
      text: uv.vocabularyItem.displayText,
      category: uv.vocabularyItem.category,
      level: uv.level,
      firstUsedAt: uv.firstUsedAt,
    })),
    topUsed: top.map((uv) => ({
      key: uv.vocabularyItem.normalizedText,
      text: uv.vocabularyItem.displayText,
      category: uv.vocabularyItem.category,
      totalCount: uv.totalCount,
      alternatives: safeJsonArray(uv.vocabularyItem.alternatives),
    })),
    todaysQuests,
    recentSessions: recentSessions.map((s) => ({
      id: s.id,
      scenarioName: s.scenario.name,
      endedAt: s.endedAt,
      totalTurns: s.totalTurns,
    })),
  });
}

