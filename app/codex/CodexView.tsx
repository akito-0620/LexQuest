"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import Link from "next/link";

interface CodexItem {
  key: string;
  displayText: string;
  category: "word" | "expression" | "phrase" | "function";
  meaningGroup: string | null;
  functionType: string | null;
  functionLabel: { en: string; ja: string } | null;
  level: number;
  levelLabel: string;
  xp: number;
  xpProgress: { current: number; needed: number; ratio: number };
  totalCount: number;
  firstUsedAt: string;
  lastUsedAt: string;
  status: "new" | "growing" | "stable" | "overused";
  alternatives: string[];
  recentExample: string | null;
  discoveredFromAi: boolean;
}

interface CodexPayload {
  items: CodexItem[];
  counts: { all: number; word: number; expression: number; phrase: number; function: number };
}

const CATEGORIES: { key: "all" | CodexItem["category"]; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "word", label: "単語" },
  { key: "expression", label: "表現" },
  { key: "phrase", label: "フレーズ" },
  { key: "function", label: "機能" },
];

const STATUSES: { key: "all" | CodexItem["status"]; label: string; hint: string }[] = [
  { key: "all", label: "すべての状態", hint: "" },
  { key: "new", label: "新規", hint: "新しいエントリ" },
  { key: "growing", label: "成長中", hint: "馴染んできた" },
  { key: "stable", label: "定着", hint: "しっかり定着" },
  { key: "overused", label: "使い過ぎ", hint: "別の言い方も試そう" },
];

const STATUS_LABEL: Record<string, string> = {
  new: "新規",
  growing: "成長中",
  stable: "定着",
  overused: "使い過ぎ",
};

const CATEGORY_CLASS: Record<string, string> = {
  word: "chip-word",
  expression: "chip-expression",
  phrase: "chip-phrase",
  function: "chip-function",
};

const STATUS_CLASS: Record<string, string> = {
  new: "bg-quest-gold/15 text-quest-gold",
  growing: "bg-quest-sapphire/15 text-quest-sapphire",
  stable: "bg-quest-emerald/15 text-quest-emerald",
  overused: "bg-quest-ruby/15 text-quest-ruby",
};

export default function CodexView() {
  const [category, setCategory] = useState<"all" | CodexItem["category"]>("all");
  const [status, setStatus] = useState<"all" | CodexItem["status"]>("all");
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CodexPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (status !== "all") params.set("status", status);
    fetch(`/api/vocabulary?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("図鑑の読み込みに失敗しました");
        return (await r.json()) as CodexPayload;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "不明なエラー");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category, status]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    if (!q) return data.items;
    return data.items.filter(
      (i) =>
        i.displayText.toLowerCase().includes(q) ||
        i.alternatives.some((a) => a.toLowerCase().includes(q)) ||
        (i.meaningGroup ?? "").toLowerCase().includes(q),
    );
  }, [data, query]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="heading-serif text-4xl font-semibold">語彙図鑑</h1>
        <p className="mt-2 max-w-2xl text-ink-700">
          LexQuestでの会話で使った単語・表現・機能の一覧です。何が育ち、どれに偏り始めているかが見えます。AIの発話から発見した未使用の言葉も収録されます。
        </p>
      </div>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((c) => {
            const count = data?.counts?.[c.key as keyof typeof data.counts] ?? 0;
            const active = category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={clsx(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  active
                    ? "bg-ink-900 text-parchment-50 shadow-panel"
                    : "border border-parchment-200 bg-white/70 text-ink-700 hover:bg-white",
                )}
              >
                {c.label}
                <span className={clsx("ml-1.5 text-xs", active ? "opacity-70" : "text-ink-500")}>
                  {count}
                </span>
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="rounded-full border border-parchment-200 bg-white/70 px-3 py-1.5 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="表現を検索..."
              className="w-48 rounded-full border border-parchment-200 bg-white/70 px-3 py-1.5 text-sm outline-none focus:border-quest-gold"
            />
          </div>
        </div>
      </section>

      {loading && (
        <div className="panel p-8 text-center text-sm text-ink-500">図鑑を読み込み中...</div>
      )}
      {error && (
        <div className="panel p-6 text-sm text-quest-ruby">
          {error}
        </div>
      )}
      {!loading && !error && data && filtered.length === 0 && (
        <div className="panel p-10 text-center">
          <h2 className="heading-serif text-2xl font-semibold">ここの図鑑はまだ空です。</h2>
          <p className="mt-2 text-sm text-ink-700">
            会話を始めると、あなたの言葉が少しずつ並び始めます。
          </p>
          <div className="mt-4">
            <Link href="/scenarios" className="btn-primary">
              会話を始める →
            </Link>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => {
          const isOpen = expandedKey === item.key;
          return (
            <article
              key={item.key}
              className={clsx(
                "panel p-4 transition",
                isOpen && "ring-2 ring-quest-gold/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={CATEGORY_CLASS[item.category] ?? "chip"}>
                      {labelForCategory(item.category)}
                    </span>
                    <span className={clsx("chip", STATUS_CLASS[item.status])}>
                      {STATUS_LABEL[item.status] ?? item.status}
                    </span>
                    {item.discoveredFromAi && item.totalCount === 0 && (
                      <span className="chip bg-quest-sapphire/15 text-quest-sapphire">
                        AI発見・未使用
                      </span>
                    )}
                  </div>
                  <h3 className="heading-serif text-xl font-semibold leading-tight">
                    {item.displayText}
                  </h3>
                  {item.functionLabel && (
                    <p className="text-xs text-ink-500">
                      {item.functionLabel.en} / {item.functionLabel.ja}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                    Lv. {item.level}
                  </div>
                  <div className="font-serif text-sm">{item.levelLabel}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="xp-bar flex-1">
                  <span style={{ width: `${item.xpProgress.ratio * 100}%` }} />
                </div>
                <span className="text-[10px] font-semibold text-ink-500">
                  {item.xpProgress.current}/{item.xpProgress.needed}
                </span>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoBit label="使用回数" value={`${item.totalCount}回`} />
                <InfoBit label="初登場" value={formatShort(item.firstUsedAt)} />
                <InfoBit label="直近" value={formatShort(item.lastUsedAt)} />
                <InfoBit label="XP" value={item.xp.toString()} />
              </dl>

              <button
                type="button"
                onClick={() => setExpandedKey(isOpen ? null : item.key)}
                className="mt-3 text-xs font-semibold text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline"
              >
                {isOpen ? "詳細を隠す" : "詳細を見る"}
              </button>

              {isOpen && (
                <div className="mt-3 space-y-3 border-t border-parchment-200 pt-3">
                  {item.recentExample && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        {item.totalCount > 0 ? "直近の使用例" : "発見された文脈"}
                      </div>
                      <blockquote className="mt-1 rounded-lg bg-parchment-100 p-2 text-sm italic text-ink-700">
                        "{item.recentExample}"
                      </blockquote>
                    </div>
                  )}
                  {item.alternatives.length > 0 && (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                        代わりに試せる表現
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.alternatives.map((a) => (
                          <span key={a} className="pill">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.meaningGroup && (
                    <div className="text-[11px] text-ink-500">
                      グループ: <span className="font-semibold">{item.meaningGroup}</span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function labelForCategory(c: string): string {
  switch (c) {
    case "word":
      return "単語";
    case "expression":
      return "表現";
    case "phrase":
      return "フレーズ";
    case "function":
      return "機能";
    default:
      return c;
  }
}

function formatShort(d: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", { month: "short", day: "numeric" }).format(new Date(d));
  } catch {
    return "—";
  }
}

function InfoBit({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
