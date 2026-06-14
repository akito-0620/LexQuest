// XP / level rules for vocabulary items and the player.

import type { ExtractedVocab } from "./vocabulary-extractor";

export const XP = {
  BASE: 10,
  DISCOVERY: 15,
  VARIETY: 10,
  QUEST: 15,
  CONTEXT_FIT: 5,
  REPETITION_PENALTY: -4,
} as const;

/** Cumulative XP required to reach each vocabulary level (index = level - 1). */
export const VOCAB_LEVEL_THRESHOLDS = [0, 30, 100, 240, 480];
export const MAX_VOCAB_LEVEL = VOCAB_LEVEL_THRESHOLDS.length; // 5

export const VOCAB_LEVEL_LABELS = ["新規", "慣らし", "成長中", "馴染み", "定着"];

export function levelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < VOCAB_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= VOCAB_LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

export function nextLevelThreshold(level: number): number | null {
  if (level >= MAX_VOCAB_LEVEL) return null;
  return VOCAB_LEVEL_THRESHOLDS[level];
}

export function progressWithinLevel(
  xp: number,
  level: number,
): { current: number; needed: number; ratio: number } {
  const floor = VOCAB_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = VOCAB_LEVEL_THRESHOLDS[level] ?? VOCAB_LEVEL_THRESHOLDS[VOCAB_LEVEL_THRESHOLDS.length - 1];
  const needed = Math.max(1, next - floor);
  const current = Math.max(0, xp - floor);
  return { current, needed, ratio: Math.min(1, current / needed) };
}

export interface AwardInput {
  isFirstEverUse: boolean;
  meaningGroupUsedBeforeInSession: boolean;
  satisfiesActiveQuest: boolean;
  fitsScenarioContext: boolean;
  sessionUsageCount: number; // 1-based count INCLUDING this usage
  itemCategory: "word" | "expression" | "phrase" | "function";
  hasMeaningGroup: boolean;
}

export interface AwardResult {
  baseXp: number;
  discoveryBonus: number;
  varietyBonus: number;
  questBonus: number;
  contextBonus: number;
  repetitionPenalty: number;
  totalXp: number;
  notes: string[];
}

export function computeAward(input: AwardInput): AwardResult {
  const notes: string[] = [];
  let base = XP.BASE;
  let discovery = 0;
  let variety = 0;
  let quest = 0;
  let context = 0;
  let penalty = 0;

  if (input.isFirstEverUse) {
    discovery = XP.DISCOVERY;
    notes.push("discovery");
  }

  // Variety bonus: first item in this meaning group used in the session
  // Most useful for items that HAVE a meaning group (i.e. alternatives exist).
  if (input.hasMeaningGroup && !input.meaningGroupUsedBeforeInSession) {
    variety = XP.VARIETY;
    notes.push("variety");
  }

  if (input.satisfiesActiveQuest) {
    quest = XP.QUEST;
    notes.push("quest");
  }

  if (input.fitsScenarioContext) {
    context = XP.CONTEXT_FIT;
    notes.push("context-fit");
  }

  // Repetition penalty — only for simple words without a meaning group
  // (we want to discourage spamming a single easy word, but not penalize a phrase hit).
  if (
    input.itemCategory === "word" &&
    !input.hasMeaningGroup &&
    input.sessionUsageCount > 3
  ) {
    penalty = XP.REPETITION_PENALTY * (input.sessionUsageCount - 3);
    notes.push("repetition-penalty");
  }

  // Extra repetition softener even with meaning group: mild penalty beyond 5 uses.
  if (input.sessionUsageCount > 5 && penalty === 0) {
    penalty = XP.REPETITION_PENALTY;
    notes.push("soft-repetition");
  }

  const total = Math.max(1, base + discovery + variety + quest + context + penalty);

  return {
    baseXp: base,
    discoveryBonus: discovery,
    varietyBonus: variety,
    questBonus: quest,
    contextBonus: context,
    repetitionPenalty: penalty,
    totalXp: total,
    notes,
  };
}

// ————————————————————————————————————————————————————————————
// Player XP / level
// ————————————————————————————————————————————————————————————
export const PLAYER_LEVEL_THRESHOLDS = [0, 50, 150, 350, 600, 900, 1300, 1800];

export function playerLevelFromXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < PLAYER_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= PLAYER_LEVEL_THRESHOLDS[i]) lvl = i + 1;
  }
  return lvl;
}

export function playerProgress(xp: number): { level: number; current: number; needed: number; ratio: number } {
  const level = playerLevelFromXp(xp);
  const floor = PLAYER_LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = PLAYER_LEVEL_THRESHOLDS[level] ?? floor + 500;
  const needed = Math.max(1, next - floor);
  const current = Math.max(0, xp - floor);
  return { level, current, needed, ratio: Math.min(1, current / needed) };
}

// ————————————————————————————————————————————————————————————
// Status classification
// ————————————————————————————————————————————————————————————
export type VocabStatus = "new" | "growing" | "stable" | "overused";

export function classifyStatus(params: {
  level: number;
  totalCount: number;
  hasMeaningGroup: boolean;
  varietyRatio: number; // 0..1, fraction of recent uses whose meaningGroup == this one (higher = more overused)
}): VocabStatus {
  const { level, totalCount, hasMeaningGroup, varietyRatio } = params;
  if (hasMeaningGroup && totalCount >= 12 && varietyRatio > 0.7) return "overused";
  if (level >= 4) return "stable";
  if (totalCount < 3 && level === 1) return "new";
  return "growing";
}

/** Helper used when aggregating extracted vocab into a set of session-unique meaning groups. */
export function collectMeaningGroups(items: ExtractedVocab[]): Set<string> {
  const s = new Set<string>();
  for (const v of items) if (v.meaningGroup) s.add(v.meaningGroup);
  return s;
}
