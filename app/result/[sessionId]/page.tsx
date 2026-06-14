import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureSessionEnded } from "@/lib/end-session";
import { prisma } from "@/lib/db";
import { categoryChipClass, categoryLabel } from "@/lib/format";
import SurveyForm from "./SurveyForm";

export const dynamic = "force-dynamic";

export default async function ResultPage({ params }: { params: { sessionId: string } }) {
  const summary = await ensureSessionEnded(params.sessionId);
  if (!summary) notFound();

  const existingSurvey = await prisma.surveyResponse.findUnique({
    where: { sessionId: params.sessionId },
  });

  const nothingHappened =
    summary.totalTurns === 0 && summary.newItems.length === 0 && summary.totalXpGained === 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="pill mb-2">セッション結果 · {summary.scenarioName}</div>
            <h1 className="heading-serif text-3xl font-semibold md:text-4xl">
              {nothingHappened ? "セッション終了" : "お疲れさま。今回育った言葉です。"}
            </h1>
            <p className="mt-2 text-ink-700">
              あなたのターン{summary.totalTurns}回 · メッセージ合計{summary.totalMessages}件
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Metric label="獲得XP" value={`+${summary.totalXpGained}`} />
            <Metric label="プレイヤーXP" value={`+${summary.playerXpGained}`} />
            <Metric label="新規" value={summary.newItems.length.toString()} />
            <Metric label="レベルUP" value={summary.leveledUpItems.length.toString()} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <Panel
          title="新しい表現"
          hint={
            summary.newItems.length === 0
              ? "今回は新しい登録なし。次回は未知の表現にも挑戦してみよう。"
              : `${summary.newItems.length}件を新規登録。`
          }
        >
          {summary.newItems.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {summary.newItems.map((it) => (
                <li key={it.key}>
                  <VocabPill
                    category={it.category}
                    text={it.displayText}
                    accent="new"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel
          title="レベルアップ"
          hint={
            summary.leveledUpItems.length === 0
              ? "今回はレベルアップなし。表現を変えながら使い続けてみよう！"
              : `${summary.leveledUpItems.length}件の表現が育ちました。`
          }
        >
          {summary.leveledUpItems.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.leveledUpItems.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={categoryChipClass(it.category)}>
                      {categoryLabel(it.category)}
                    </span>
                    <span className="font-medium">{it.displayText}</span>
                  </div>
                  <span className="chip bg-quest-emerald/15 text-quest-emerald">
                    Lv. {it.level}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel
          title="よく使った表現"
          hint={
            summary.frequentItems.length === 0
              ? "特に目立った繰り返しはまだありません。"
              : "このセッションでよく登場した表現です。"
          }
        >
          {summary.frequentItems.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {summary.frequentItems.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className={categoryChipClass(it.category)}>
                      {categoryLabel(it.category)}
                    </span>
                    <span className="font-medium">{it.displayText}</span>
                  </div>
                  <span className="pill">セッション内{it.usageInSession}回</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel
          title="次回試したいこと"
          hint={
            summary.suggestions.length === 0 && summary.missingFunctions.length === 0
              ? "すでに表現をうまく混ぜられています — いいバランスです。"
              : "次の会話でちょっと試してみたいヒント。"
          }
        >
          {summary.suggestions.length > 0 && (
            <div className="space-y-3">
              {summary.suggestions.map((s, i) => (
                <div key={i} className="rounded-lg bg-quest-gold/10 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-quest-gold">
                    "{s.basedOn}" の代わりに
                  </div>
                  <div className="mt-1 text-sm">{s.alternatives.join(" · ")}</div>
                </div>
              ))}
            </div>
          )}
          {summary.missingFunctions.length > 0 && (
            <div className="mt-3 border-t border-parchment-200 pt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                未使用の会話機能
              </div>
              <ul className="mt-2 space-y-2">
                {summary.missingFunctions.map((m) => (
                  <li key={m.functionType} className="text-sm">
                    <span className="chip chip-function mr-2">{m.ja}</span>
                    {m.example && (
                      <span className="italic text-ink-700">"{m.example}"</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <section className="panel p-6">
        <h2 className="heading-serif text-2xl font-semibold">クエスト結果</h2>
        {summary.quests.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">このセッションではアクティブなクエストがありませんでした。</p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {summary.quests.map((q) => {
              const ratio = Math.min(1, q.progress / Math.max(1, q.target));
              return (
                <li
                  key={q.slug}
                  className={`panel-tight p-4 ${q.completed ? "border-quest-gold/40" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`chip ${q.completed ? "bg-quest-emerald/15 text-quest-emerald" : "bg-parchment-200 text-ink-700"}`}
                    >
                      {q.completed ? "✓ 達成" : "未達成"}
                    </span>
                    <span className="text-xs font-semibold text-ink-500">
                      +{q.rewardXp} XP
                    </span>
                  </div>
                  <h3 className="mt-2 font-serif text-base font-semibold">{q.title}</h3>
                  <p className="mt-1 text-xs text-ink-500">{q.description}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="xp-bar flex-1">
                      <span
                        style={{ width: `${ratio * 100}%` }}
                        className={q.completed ? "!bg-quest-emerald" : ""}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-ink-500">
                      {q.progress}/{q.target}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel p-6">
        <div className="flex items-center justify-between">
          <h2 className="heading-serif text-2xl font-semibold">今回の感想を教えてください</h2>
          {existingSurvey && (
            <span className="pill text-[10px]">
              送信済み · ありがとうございます！
            </span>
          )}
        </div>
        <SurveyForm
          sessionId={params.sessionId}
          initial={
            existingSurvey
              ? {
                  ease: existingSurvey.ease,
                  agency: existingSurvey.agency,
                  motivation: existingSurvey.motivation,
                  confidence: existingSurvey.confidence,
                  reuseIntent: existingSurvey.reuseIntent,
                  freeComment: existingSurvey.freeComment ?? "",
                }
              : null
          }
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Link href="/scenarios" className="btn-primary">
          もう一度会話する →
        </Link>
        <Link href="/codex" className="btn-secondary">
          図鑑を開く
        </Link>
        <Link href="/" className="btn-ghost">
          ホームに戻る
        </Link>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel-tight px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-ink-500">{label}</div>
      <div className="font-serif text-xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="panel p-6">
      <h2 className="heading-serif text-xl font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}

function VocabPill({
  category,
  text,
  accent,
}: {
  category: string;
  text: string;
  accent?: "new" | "level";
}) {
  return (
    <span className="panel-tight inline-flex items-center gap-2 px-3 py-1.5 text-sm">
      <span className={categoryChipClass(category)}>{categoryLabel(category)}</span>
      <span className="font-medium">{text}</span>
      {accent === "new" && (
        <span className="chip bg-quest-gold/15 text-quest-gold">新規</span>
      )}
    </span>
  );
}
