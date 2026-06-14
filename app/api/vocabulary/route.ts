import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { VOCAB_LEVEL_LABELS, progressWithinLevel } from "@/lib/xp";
import { FUNCTION_LABELS } from "@/lib/vocabulary-dictionary";
import { safeJsonArray } from "@/lib/session-summary";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getOrCreateDefaultUser();
  const url = new URL(req.url);
  const category = url.searchParams.get("category"); // optional filter
  const status = url.searchParams.get("status");

  const where: { userId: string; vocabularyItem?: { category: string }; status?: string } = {
    userId: user.id,
  };
  if (category && category !== "all") {
    where.vocabularyItem = { category };
  }
  if (status && status !== "all") {
    where.status = status;
  }

  const userVocab = await prisma.userVocabulary.findMany({
    where,
    orderBy: [{ lastUsedAt: "desc" }],
    include: {
      vocabularyItem: true,
    },
  });

  // Recent usage examples: pick the most recent usage per item
  const vocabIds = userVocab.map((uv) => uv.vocabularyItemId);
  const recentUsagesRaw = vocabIds.length
    ? await prisma.vocabularyUsage.findMany({
        where: { userId: user.id, vocabularyItemId: { in: vocabIds } },
        orderBy: { createdAt: "desc" },
        include: { message: true },
        take: 500,
      })
    : [];
  const recentUsageByItem = new Map<string, { content: string; createdAt: Date }>();
  for (const u of recentUsagesRaw) {
    if (!recentUsageByItem.has(u.vocabularyItemId)) {
      recentUsageByItem.set(u.vocabularyItemId, {
        content: u.message.content,
        createdAt: u.createdAt,
      });
    }
  }

  const items = userVocab.map((uv) => {
    const p = progressWithinLevel(uv.xp, uv.level);
    const alt = safeJsonArray(uv.vocabularyItem.alternatives);
    const fnLabel = uv.vocabularyItem.functionType
      ? FUNCTION_LABELS[uv.vocabularyItem.functionType]
      : null;
    const recent = recentUsageByItem.get(uv.vocabularyItemId);
    return {
      key: uv.vocabularyItem.normalizedText,
      displayText: uv.vocabularyItem.displayText,
      category: uv.vocabularyItem.category,
      meaningGroup: uv.vocabularyItem.meaningGroup,
      functionType: uv.vocabularyItem.functionType,
      functionLabel: fnLabel,
      level: uv.level,
      levelLabel: VOCAB_LEVEL_LABELS[uv.level - 1] ?? "New",
      xp: uv.xp,
      xpProgress: p,
      totalCount: uv.totalCount,
      firstUsedAt: uv.firstUsedAt,
      lastUsedAt: uv.lastUsedAt,
      status: uv.status,
      alternatives: alt,
      recentExample: recent?.content ?? null,
      discoveredFromAi: uv.discoveredFromAi,
    };
  });

  // Category counts (across all, regardless of filter)
  const all = await prisma.userVocabulary.findMany({
    where: { userId: user.id },
    include: { vocabularyItem: true },
  });
  const counts = {
    all: all.length,
    word: all.filter((uv) => uv.vocabularyItem.category === "word").length,
    expression: all.filter((uv) => uv.vocabularyItem.category === "expression").length,
    phrase: all.filter((uv) => uv.vocabularyItem.category === "phrase").length,
    function: all.filter((uv) => uv.vocabularyItem.category === "function").length,
  };

  return NextResponse.json({ items, counts });
}
