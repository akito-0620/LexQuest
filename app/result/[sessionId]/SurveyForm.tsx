"use client";

import { useState } from "react";
import clsx from "clsx";

interface SurveyInitial {
  ease: number;
  agency: number;
  motivation: number;
  confidence: number;
  reuseIntent: number;
  freeComment: string;
}

const QUESTIONS: { key: keyof Omit<SurveyInitial, "freeComment">; label: string; lowLabel: string; highLabel: string }[] = [
  {
    key: "ease",
    label: "会話を続けやすかった。",
    lowLabel: "難しい",
    highLabel: "簡単",
  },
  {
    key: "agency",
    label: "自分で考えながら話せた。",
    lowLabel: "あまり",
    highLabel: "とても",
  },
  {
    key: "motivation",
    label: "次回は新しい表現を試したい。",
    lowLabel: "思わない",
    highLabel: "思う",
  },
  {
    key: "confidence",
    label: "英語で話すことが以前より怖くなくなった。",
    lowLabel: "変わらず",
    highLabel: "怖くなくなった",
  },
  {
    key: "reuseIntent",
    label: "LexQuestをまた使いたい。",
    lowLabel: "思わない",
    highLabel: "強く思う",
  },
];

export default function SurveyForm({
  sessionId,
  initial,
}: {
  sessionId: string;
  initial: SurveyInitial | null;
}) {
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    if (initial) {
      init.ease = initial.ease;
      init.agency = initial.agency;
      init.motivation = initial.motivation;
      init.confidence = initial.confidence;
      init.reuseIntent = initial.reuseIntent;
    }
    return init;
  });
  const [comment, setComment] = useState(initial?.freeComment ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!!initial);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/survey`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...scores, freeComment: comment }),
      });
      if (!res.ok) throw new Error("アンケートの保存に失敗しました");
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "不明なエラー");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        {QUESTIONS.map((q) => (
          <div key={q.key}>
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">{q.label}</label>
              <span className="text-[10px] uppercase tracking-wider text-ink-500">
                7段階
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="hidden w-12 text-right text-[11px] text-ink-500 sm:inline">
                {q.lowLabel}
              </span>
              <div className="flex flex-1 items-center gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => {
                  const selected = scores[q.key] === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setScores((s) => ({ ...s, [q.key]: n }))}
                      className={clsx(
                        "h-9 flex-1 rounded-md border text-sm font-semibold transition",
                        selected
                          ? "border-quest-gold bg-quest-gold text-parchment-50 shadow-panel"
                          : "border-parchment-200 bg-white/70 text-ink-700 hover:border-quest-gold/60",
                      )}
                      aria-pressed={selected}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <span className="hidden w-12 text-[11px] text-ink-500 sm:inline">
                {q.highLabel}
              </span>
            </div>
          </div>
        ))}
      </div>

      <label className="block">
        <span className="text-sm font-medium">
          他にあれば <span className="text-ink-500">(任意)</span>
        </span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="mt-1.5 w-full rounded-xl border border-parchment-200 bg-white/90 px-3 py-2 text-sm outline-none focus:border-quest-gold"
          placeholder="よかった点、ぎこちなかった点..."
        />
      </label>

      {error && <p className="text-xs text-quest-ruby">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="btn-primary"
          disabled={submitting || Object.keys(scores).length < QUESTIONS.length}
        >
          {submitting ? "保存中..." : submitted ? "フィードバックを更新" : "フィードバックを送信"}
        </button>
        {submitted && !submitting && (
          <span className="text-xs text-quest-emerald">保存しました · ありがとうございます。</span>
        )}
      </div>
    </form>
  );
}
