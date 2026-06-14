import {
  SEED_VOCABULARY,
  SEED_BY_KEY,
  STOPWORDS,
  type SeedVocab,
  type VocabCategory,
} from "./vocabulary-dictionary";

export interface ExtractedVocab {
  normalizedText: string;
  displayText: string;
  category: VocabCategory;
  meaningGroup?: string;
  functionType?: string;
  alternatives: string[];
  /** Was this item already in the seed dictionary? If false it's a new dynamic word. */
  fromSeed: boolean;
  /** How many times it surfaced in this single message (for reference; we still credit once per message). */
  occurrences: number;
}

const TOKEN_REGEX = /[a-z][a-z'-]*/gi;
const WORD_BOUNDARY = /[a-z']/i;

/** Normalize a message to lowercased space-separated words. Keeps apostrophes. */
export function normalizeText(raw: string): string {
  const lowered = raw.toLowerCase();
  // replace anything that isn't a letter/apostrophe/dash with a space
  const cleaned = lowered.replace(/[^a-z'\-\s]/g, " ");
  return cleaned.replace(/\s+/g, " ").trim();
}

interface TokenPos {
  text: string;
  start: number;
  end: number; // exclusive
}

function tokenizeWithPositions(normalized: string): TokenPos[] {
  const out: TokenPos[] = [];
  for (const m of normalized.matchAll(TOKEN_REGEX)) {
    if (m.index === undefined) continue;
    out.push({ text: m[0].toLowerCase(), start: m.index, end: m.index + m[0].length });
  }
  return out;
}

interface Span {
  start: number;
  end: number; // exclusive
}

function isWithinAnySpan(pos: number, spans: Span[]): boolean {
  for (const s of spans) if (pos >= s.start && pos < s.end) return true;
  return false;
}

/**
 * Extract vocabulary matches from a single user message.
 *
 * Strategy:
 *   1. Scan for all seed entries (words, expressions, phrases, functions).
 *      Each entry's `patterns` are probed via word-boundary substring match.
 *      Multi-word matches (length > 1 token) reserve a span so we don't also
 *      emit their constituent words as dynamic entries.
 *   2. Collect remaining content-words (not stopwords, len >= 3) as dynamic word entries.
 */
export function extractVocabulary(rawMessage: string): ExtractedVocab[] {
  const normalized = normalizeText(rawMessage);
  if (!normalized) return [];

  const found = new Map<string, ExtractedVocab>();
  const occupiedSpans: Span[] = [];

  // Phase 1: seed dictionary matches
  for (const seed of SEED_VOCABULARY) {
    let hits = 0;
    const hitSpans: Span[] = [];
    for (const pattern of seed.patterns) {
      const normPattern = pattern.trim().toLowerCase();
      if (!normPattern) continue;
      let searchFrom = 0;
      while (searchFrom < normalized.length) {
        const idx = normalized.indexOf(normPattern, searchFrom);
        if (idx === -1) break;
        const before = normalized[idx - 1];
        const after = normalized[idx + normPattern.length];
        const leftOk = !before || !WORD_BOUNDARY.test(before);
        const rightOk = !after || !WORD_BOUNDARY.test(after);
        if (leftOk && rightOk) {
          hits += 1;
          hitSpans.push({ start: idx, end: idx + normPattern.length });
        }
        searchFrom = idx + Math.max(1, normPattern.length);
      }
    }
    if (hits > 0) {
      found.set(seed.normalizedText, {
        normalizedText: seed.normalizedText,
        displayText: seed.displayText,
        category: seed.category,
        meaningGroup: seed.meaningGroup,
        functionType: seed.functionType,
        alternatives: seed.alternatives ?? [],
        fromSeed: true,
        occurrences: hits,
      });
      // Only multi-word matches suppress dynamic-word extraction inside their span.
      if (seed.category !== "word") {
        for (const sp of hitSpans) occupiedSpans.push(sp);
      }
    }
  }

  // Phase 2: dynamic word extraction
  const tokens = tokenizeWithPositions(normalized);
  const seedWordForms = buildSeedWordFormIndex();
  const tokenCounts = new Map<string, number>();
  for (const tok of tokens) {
    if (tok.text.length < 3) continue;
    if (STOPWORDS.has(tok.text)) continue;
    if (seedWordForms.has(tok.text)) continue;
    if (isWithinAnySpan(tok.start, occupiedSpans)) continue;
    tokenCounts.set(tok.text, (tokenCounts.get(tok.text) ?? 0) + 1);
  }
  for (const [tok, count] of tokenCounts) {
    if (found.has(tok)) continue;
    found.set(tok, {
      normalizedText: tok,
      displayText: tok,
      category: "word",
      fromSeed: false,
      alternatives: [],
      occurrences: count,
    });
  }

  return Array.from(found.values());
}

let _seedWordFormIndex: Set<string> | null = null;
function buildSeedWordFormIndex(): Set<string> {
  if (_seedWordFormIndex) return _seedWordFormIndex;
  const s = new Set<string>();
  for (const v of SEED_VOCABULARY) {
    if (v.category !== "word") continue;
    for (const p of v.patterns) s.add(p.toLowerCase());
  }
  _seedWordFormIndex = s;
  return s;
}

/** Given an arbitrary vocab key, look up seed metadata if any. */
export function getSeedByKey(key: string): SeedVocab | undefined {
  return SEED_BY_KEY.get(key);
}
