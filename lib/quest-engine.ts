// Quest target schema + evaluator.

import type { ExtractedVocab } from "./vocabulary-extractor";

export type QuestTarget =
  | { kind: "new"; count: number }
  | { kind: "variation"; meaningGroup: string; avoidNormalizedText?: string }
  | { kind: "function"; functionType: string; count: number }
  | { kind: "continuation"; userTurns: number };

export interface QuestDef {
  slug: string;
  type: QuestTarget["kind"];
  title: string;
  description: string;
  target: QuestTarget;
  rewardXp: number;
}

export const QUEST_CATALOG: QuestDef[] = [
  {
    slug: "new_expression",
    type: "new",
    title: "新しい表現を1つ使う",
    description: "LexQuestでまだ使ったことのない単語・表現・フレーズを試してみよう。",
    target: { kind: "new", count: 1 },
    rewardXp: 20,
  },
  {
    slug: "variation_like",
    type: "variation",
    title: "'like' 以外の単語を使う",
    description: "'like' の代わりに 'enjoy' / 'love' / 'be into' / 'prefer' を試してみよう。",
    target: { kind: "variation", meaningGroup: "like", avoidNormalizedText: "like" },
    rewardXp: 25,
  },
  {
    slug: "variation_good",
    type: "variation",
    title: "'good' 以外の単語を使う",
    description: "'good' の代わりに 'great' / 'nice' / 'wonderful' を試してみよう。",
    target: { kind: "variation", meaningGroup: "positive", avoidNormalizedText: "good" },
    rewardXp: 20,
  },
  {
    slug: "function_follow_up",
    type: "function",
    title: "追加の質問をする",
    description: "'why?' や 'can you tell me more?' のような追加質問を投げてみよう。",
    target: { kind: "function", functionType: "follow_up_question", count: 1 },
    rewardXp: 25,
  },
  {
    slug: "function_question_back",
    type: "function",
    title: "質問を返す",
    description: "'what about you?' や 'how about you?' で質問を返してみよう。",
    target: { kind: "function", functionType: "question_back", count: 1 },
    rewardXp: 20,
  },
  {
    slug: "function_impression",
    type: "function",
    title: "感想を伝える",
    description: "'that sounds fun!' や 'that's amazing!' のような感想でリアクション。",
    target: { kind: "function", functionType: "impression", count: 1 },
    rewardXp: 20,
  },
  {
    slug: "function_back_channel",
    type: "function",
    title: "相槌を打つ",
    description: "'wow' / 'I see' / 'really?' で聞いているサインを出そう。",
    target: { kind: "function", functionType: "back_channel", count: 1 },
    rewardXp: 15,
  },
  {
    slug: "continuation_6",
    type: "continuation",
    title: "会話を続ける",
    description: "自分のターンを最低6回まで会話を続けてみよう。",
    target: { kind: "continuation", userTurns: 6 },
    rewardXp: 25,
  },
];

export const QUEST_BY_SLUG = new Map(QUEST_CATALOG.map((q) => [q.slug, q]));

// ————————————————————————————————————————————————————————————
// Evaluation
// ————————————————————————————————————————————————————————————

export interface SessionQuestState {
  userTurns: number;
  /** normalized keys that were first-ever-used (isNew) anywhere in the session */
  newKeysUsed: Set<string>;
  /** normalized keys used (anywhere in session) */
  keysUsed: Set<string>;
  /** meaning groups used this session, including which members */
  meaningGroupMembers: Map<string, Set<string>>;
  /** function types used and total count */
  functionTypeCounts: Map<string, number>;
}

export function emptySessionState(): SessionQuestState {
  return {
    userTurns: 0,
    newKeysUsed: new Set(),
    keysUsed: new Set(),
    meaningGroupMembers: new Map(),
    functionTypeCounts: new Map(),
  };
}

export function foldVocabIntoState(
  state: SessionQuestState,
  extracted: ExtractedVocab[],
  isNewByKey: Map<string, boolean>,
): void {
  state.userTurns += 1;
  for (const v of extracted) {
    state.keysUsed.add(v.normalizedText);
    if (isNewByKey.get(v.normalizedText)) state.newKeysUsed.add(v.normalizedText);
    if (v.meaningGroup) {
      if (!state.meaningGroupMembers.has(v.meaningGroup)) {
        state.meaningGroupMembers.set(v.meaningGroup, new Set());
      }
      state.meaningGroupMembers.get(v.meaningGroup)!.add(v.normalizedText);
    }
    if (v.functionType) {
      state.functionTypeCounts.set(
        v.functionType,
        (state.functionTypeCounts.get(v.functionType) ?? 0) + 1,
      );
    }
  }
}

export function evaluateQuest(
  def: QuestDef,
  state: SessionQuestState,
): { progress: number; target: number; completed: boolean } {
  const t = def.target;
  switch (t.kind) {
    case "new": {
      const progress = state.newKeysUsed.size;
      return { progress: Math.min(progress, t.count), target: t.count, completed: progress >= t.count };
    }
    case "variation": {
      const members = state.meaningGroupMembers.get(t.meaningGroup) ?? new Set();
      const hit = Array.from(members).some((m) => m !== t.avoidNormalizedText);
      return { progress: hit ? 1 : 0, target: 1, completed: hit };
    }
    case "function": {
      const count = state.functionTypeCounts.get(t.functionType) ?? 0;
      return {
        progress: Math.min(count, t.count),
        target: t.count,
        completed: count >= t.count,
      };
    }
    case "continuation": {
      return {
        progress: Math.min(state.userTurns, t.userTurns),
        target: t.userTurns,
        completed: state.userTurns >= t.userTurns,
      };
    }
  }
}

/** For the CURRENT turn's extracted vocab, does any item satisfy the quest's target? Used for Quest Bonus XP. */
export function questBonusApplicable(
  def: QuestDef,
  v: ExtractedVocab,
  isFirstEver: boolean,
): boolean {
  const t = def.target;
  switch (t.kind) {
    case "new":
      return isFirstEver;
    case "variation":
      return v.meaningGroup === t.meaningGroup && v.normalizedText !== t.avoidNormalizedText;
    case "function":
      return v.functionType === t.functionType;
    case "continuation":
      return false; // continuation is turn-count based, no per-item bonus
  }
}
