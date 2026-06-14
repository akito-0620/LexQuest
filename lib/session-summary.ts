import { prisma } from "./db";
import { FUNCTION_LABELS, SEED_BY_KEY } from "./vocabulary-dictionary";
import { QUEST_BY_SLUG, evaluateQuest, emptySessionState } from "./quest-engine";
import type { QuestTarget } from "./quest-engine";
import { levelFromXp, playerLevelFromXp, classifyStatus } from "./xp";

export interface SessionSummary {
  sessionId: string;
  scenarioName: string;
  scenarioSlug: string;
  totalTurns: number;
  totalMessages: number;
  totalXpGained: number;
  newItems: VocabCard[];
  leveledUpItems: VocabCard[];
  frequentItems: VocabCard[];
  overusedItems: VocabCard[];
  suggestions: Suggestion[];
  missingFunctions: MissingFunction[];
  quests: SessionQuestResult[];
  questRewardXp: number;
}

export interface VocabCard {
  key: string;
  displayText: string;
  category: string;
  meaningGroup?: string | null;
  functionType?: string | null;
  level: number;
  usageInSession: number;
  totalCount: number;
  alternatives: string[];
}

export interface Suggestion {
  basedOn: string;
  alternatives: string[];
  reason: string;
}

export interface MissingFunction {
  functionType: string;
  en: string;
  ja: string;
  example: string;
}

export interface SessionQuestResult {
  slug: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardXp: number;
}

export async function buildSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenario: true,
      usages: { include: { vocabularyItem: true } },
      messages: { orderBy: { createdAt: "asc" } },
      quests: { include: { quest: true } },
    },
  });
  if (!session) return null;

  const userMessages = session.messages.filter((m) => m.role === "user");
  const turnCount = userMessages.length;

  // ——— Per-item aggregation ———
  interface ItemAgg {
    key: string;
    displayText: string;
    category: string;
    meaningGroup: string | null;
    functionType: string | null;
    usageInSession: number;
    isNew: boolean;
    maxLevelReached: number;
    leveledUp: boolean;
    alternatives: string[];
  }
  const byKey = new Map<string, ItemAgg>();
  let totalXp = 0;
  for (const u of session.usages) {
    totalXp += u.xpAwarded;
    const k = u.vocabularyItem.normalizedText;
    const existing = byKey.get(k);
    const alt = safeJsonArray(u.vocabularyItem.alternatives);
    if (existing) {
      existing.usageInSession += 1;
      existing.isNew = existing.isNew || u.isNew;
      existing.leveledUp = existing.leveledUp || u.leveledUp;
    } else {
      byKey.set(k, {
        key: k,
        displayText: u.vocabularyItem.displayText,
        category: u.vocabularyItem.category,
        meaningGroup: u.vocabularyItem.meaningGroup,
        functionType: u.vocabularyItem.functionType,
        usageInSession: 1,
        isNew: u.isNew,
        maxLevelReached: 1,
        leveledUp: u.leveledUp,
        alternatives: alt,
      });
    }
  }

  // Fetch UserVocabulary snapshot for level info
  const userVocs = await prisma.userVocabulary.findMany({
    where: {
      userId: session.userId,
      vocabularyItemId: { in: Array.from(new Set(session.usages.map((u) => u.vocabularyItemId))) },
    },
    include: { vocabularyItem: true },
  });
  const uvByItemKey = new Map(userVocs.map((uv) => [uv.vocabularyItem.normalizedText, uv]));

  const card = (agg: ItemAgg): VocabCard => {
    const uv = uvByItemKey.get(agg.key);
    return {
      key: agg.key,
      displayText: agg.displayText,
      category: agg.category,
      meaningGroup: agg.meaningGroup,
      functionType: agg.functionType,
      level: uv?.level ?? 1,
      usageInSession: agg.usageInSession,
      totalCount: uv?.totalCount ?? agg.usageInSession,
      alternatives: agg.alternatives,
    };
  };

  const newItems = Array.from(byKey.values()).filter((a) => a.isNew).map(card);
  const leveledUpItems = Array.from(byKey.values()).filter((a) => a.leveledUp).map(card);
  const frequentItems = Array.from(byKey.values())
    .sort((a, b) => b.usageInSession - a.usageInSession)
    .slice(0, 5)
    .filter((a) => a.usageInSession >= 2 || frequentPrevalence(a))
    .map(card);

  // Overused: items used >=3 times in this session AND totalCount >= 8 AND have alternatives.
  const overusedItems = Array.from(byKey.values())
    .filter((a) => {
      const uv = uvByItemKey.get(a.key);
      return (a.usageInSession >= 3 || (uv && uv.totalCount >= 10)) && a.alternatives.length > 0;
    })
    .map(card);

  // Suggestions: for each frequent-or-overused item with alternatives, propose alternatives NOT used in this session.
  const keysInSession = new Set(byKey.keys());
  const suggestions: Suggestion[] = [];
  const seenSuggestionKeys = new Set<string>();
  for (const a of Array.from(byKey.values()).sort((x, y) => y.usageInSession - x.usageInSession)) {
    if (a.alternatives.length === 0) continue;
    if (a.usageInSession < 2 && !overusedItems.some((o) => o.key === a.key)) continue;
    const untried = a.alternatives.filter(
      (alt) => !keysInSession.has(alt.toLowerCase()),
    );
    if (untried.length === 0) continue;
    if (seenSuggestionKeys.has(a.key)) continue;
    seenSuggestionKeys.add(a.key);
    suggestions.push({
      basedOn: a.displayText,
      alternatives: untried.slice(0, 3),
      reason: `You used "${a.displayText}" ${a.usageInSession} time${a.usageInSession > 1 ? "s" : ""}. Try mixing it up!`,
    });
    if (suggestions.length >= 3) break;
  }

  // Missing functions: scenario focus functions not triggered this session
  const focus = safeJsonArray(session.scenario.focusFunctions);
  const usedFunctions = new Set<string>();
  for (const u of session.usages) {
    if (u.vocabularyItem.functionType) usedFunctions.add(u.vocabularyItem.functionType);
  }
  const missingFunctions: MissingFunction[] = focus
    .filter((f) => !usedFunctions.has(f))
    .map((f) => {
      const label = FUNCTION_LABELS[f] ?? { en: f, ja: f };
      const seed = SEED_BY_KEY.get(`fn:${f}`);
      const example = seed?.alternatives?.[0] ?? seed?.patterns?.[0] ?? "";
      return { functionType: f, en: label.en, ja: label.ja, example };
    });

  // Quests
  const state = emptySessionState();
  state.userTurns = turnCount;
  for (const u of session.usages) {
    state.keysUsed.add(u.vocabularyItem.normalizedText);
    if (u.isNew) state.newKeysUsed.add(u.vocabularyItem.normalizedText);
    if (u.vocabularyItem.meaningGroup) {
      if (!state.meaningGroupMembers.has(u.vocabularyItem.meaningGroup)) {
        state.meaningGroupMembers.set(u.vocabularyItem.meaningGroup, new Set());
      }
      state.meaningGroupMembers.get(u.vocabularyItem.meaningGroup)!.add(u.vocabularyItem.normalizedText);
    }
    if (u.vocabularyItem.functionType) {
      state.functionTypeCounts.set(
        u.vocabularyItem.functionType,
        (state.functionTypeCounts.get(u.vocabularyItem.functionType) ?? 0) + 1,
      );
    }
  }
  const questResults: SessionQuestResult[] = [];
  let questRewardXp = 0;
  for (const sq of session.quests) {
    const def = QUEST_BY_SLUG.get(sq.quest.slug);
    if (!def) continue;
    const result = evaluateQuest(def, state);
    questResults.push({
      slug: sq.quest.slug,
      title: sq.quest.title,
      description: sq.quest.description,
      progress: result.progress,
      target: result.target,
      completed: result.completed,
      rewardXp: sq.quest.rewardXp,
    });
    if (result.completed) questRewardXp += sq.quest.rewardXp;
  }

  return {
    sessionId: session.id,
    scenarioName: session.scenario.name,
    scenarioSlug: session.scenario.slug,
    totalTurns: turnCount,
    totalMessages: session.messages.length,
    totalXpGained: totalXp,
    newItems,
    leveledUpItems,
    frequentItems,
    overusedItems,
    suggestions,
    missingFunctions,
    quests: questResults,
    questRewardXp,
  };
}

function frequentPrevalence(a: { usageInSession: number }): boolean {
  return a.usageInSession >= 3;
}

export function safeJsonArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// re-export for other modules
export { levelFromXp, playerLevelFromXp, classifyStatus };
export type { QuestTarget };
