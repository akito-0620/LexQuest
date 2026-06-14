import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { safeJsonArray } from "@/lib/session-summary";
import { QUEST_BY_SLUG } from "@/lib/quest-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const scenarios = await prisma.scenario.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({
    scenarios: scenarios.map((s) => ({
      slug: s.slug,
      name: s.name,
      description: s.description,
      goal: s.goal,
      focusFunctions: safeJsonArray(s.focusFunctions),
      recommendedQuests: safeJsonArray(s.recommendedQuestSlugs)
        .map((slug) => QUEST_BY_SLUG.get(slug))
        .filter((q): q is NonNullable<typeof q> => q != null)
        .map((q) => ({ slug: q.slug, title: q.title, description: q.description })),
    })),
  });
}
