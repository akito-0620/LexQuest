import { prisma } from "./db";
import { extractVocabulary } from "./vocabulary-extractor";

/**
 * Register vocabulary from an AI utterance into the user's codex.
 *
 * Behavior:
 *  - Creates a VocabularyItem if one does not exist.
 *  - Creates a UserVocabulary row the first time the user has ever seen this
 *    item, marked `discoveredFromAi` and with totalCount=0 / xp=0 / level=1.
 *  - Never touches an existing UserVocabulary row (no XP, no usage increment).
 *  - Never writes VocabularyUsage rows — those are reserved for user speech
 *    and drive session XP / quest progress.
 */
export async function unlockVocabFromAi(userId: string, text: string): Promise<void> {
  const extracted = extractVocabulary(text);
  if (extracted.length === 0) return;

  for (const v of extracted) {
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
        userId_vocabularyItemId: { userId, vocabularyItemId: item.id },
      },
    });
    if (existing) continue;

    const now = new Date();
    await prisma.userVocabulary.create({
      data: {
        userId,
        vocabularyItemId: item.id,
        xp: 0,
        level: 1,
        totalCount: 0,
        firstUsedAt: now,
        lastUsedAt: now,
        status: "new",
        discoveredFromAi: true,
      },
    });
  }
}
