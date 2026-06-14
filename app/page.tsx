import Link from "next/link";
import { prisma } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/lib/user";
import { playerProgress } from "@/lib/xp";
import { safeJsonArray } from "@/lib/session-summary";
import { categoryChipClass, categoryLabel, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getOrCreateDefaultUser();

  const [recent, top, recentSessions, totalVocab, allQuests, completedQuests] = await Promise.all([
    prisma.userVocabulary.findMany({
      where: { userId: user.id, totalCount: { gt: 0 } },
      orderBy: { lastUsedAt: "desc" },
      take: 5,
      include: { vocabularyItem: true },
    }),
    prisma.userVocabulary.findMany({
      where: { userId: user.id, totalCount: { gt: 0 } },
      orderBy: [{ totalCount: "desc" }, { lastUsedAt: "desc" }],
      take: 3,
      include: { vocabularyItem: true },
    }),
    prisma.session.findMany({
      where: { userId: user.id, endedAt: { not: null } },
      orderBy: { endedAt: "desc" },
      take: 3,
      include: { scenario: true },
    }),
    prisma.userVocabulary.count({ where: { userId: user.id } }),
    prisma.quest.findMany({ where: { active: true } }),
    prisma.userQuest.findMany({
      where: { userId: user.id, status: "completed" },
      include: { quest: true },
    }),
  ]);

  const completedSlugs = new Set(completedQuests.map((uq) => uq.quest.slug));
  const quests = allQuests
    .filter((q) => !completedSlugs.has(q.slug))
    .slice(0, 3);
  const pool = quests.length > 0 ? quests : allQuests.slice(0, 3);

  const progress = playerProgress(user.playerXp);
  const hasPlayed = totalVocab > 0 || recentSessions.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <section className="panel relative overflow-hidden p-6 md:p-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 10%, #c39a2b 0%, transparent 40%), radial-gradient(circle at 90% 70%, #3964a7 0%, transparent 45%)",
          }}
        />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <div className="pill mb-3">
              <span className="h-1.5 w-1.5 rounded-full bg-quest-emerald" />
              語彙図鑑RPG
            </div>
            <h1 className="heading-serif text-4xl font-semibold md:text-5xl">
              おかえりなさい、{user.displayName}さん。
            </h1>
            <p className="mt-3 text-ink-700 md:text-lg">
              {hasPlayed
                ? "続きから始めましょう。会話のたびに、あなたの言葉が育っていきます。"
                : "最初の図鑑エントリまで、会話ひとつ分。"}
            </p>
          </div>
          <div className="panel-tight flex min-w-[240px] flex-col gap-3 p-4">
            <div className="flex items-center justify-between text-sm text-ink-700">
              <span className="font-semibold uppercase tracking-wider text-ink-500">プレイヤー</span>
              <span className="font-serif text-2xl font-semibold">Lv. {progress.level}</span>
            </div>
            <div className="xp-bar">
              <span style={{ width: `${progress.ratio * 100}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-ink-500">
              <span>
                {progress.current} / {progress.needed} XP
              </span>
              <span>図鑑 {totalVocab} 件</span>
            </div>
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          <Link href="/scenarios" className="btn-primary">
            会話を始める →
          </Link>
          <Link href="/codex" className="btn-secondary">
            図鑑を開く
          </Link>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="panel p-6 md:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="heading-serif text-2xl font-semibold">今日のクエスト</h2>
            <span className="pill">1つ選んで挑戦</span>
          </div>
          <ul className="grid gap-3 md:grid-cols-3">
            {pool.map((q) => (
              <li key={q.id} className="panel-tight flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="chip chip-function">+{q.rewardXp} XP</span>
                </div>
                <h3 className="font-serif text-lg font-semibold leading-snug">{q.title}</h3>
                <p className="text-sm text-ink-700">{q.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel p-6">
          <h2 className="heading-serif text-2xl font-semibold">最近覚えた言葉</h2>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">
              まだありません。最初の会話で埋まります。
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {recent.map((uv) => (
                <li
                  key={uv.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={categoryChipClass(uv.vocabularyItem.category)}>
                      {categoryLabel(uv.vocabularyItem.category)}
                    </span>
                    <span className="truncate font-medium">
                      {uv.vocabularyItem.displayText}
                    </span>
                  </div>
                  <span className="text-xs text-ink-500">
                    {formatDate(uv.lastUsedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="panel p-6">
          <h2 className="heading-serif text-2xl font-semibold">よく使うTop 3</h2>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">会話を始めるとここに表示されます。</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {top.map((uv) => {
                const alts = safeJsonArray(uv.vocabularyItem.alternatives).slice(0, 3);
                return (
                  <li key={uv.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={categoryChipClass(uv.vocabularyItem.category)}>
                          {categoryLabel(uv.vocabularyItem.category)}
                        </span>
                        <span className="font-serif text-lg font-semibold">
                          {uv.vocabularyItem.displayText}
                        </span>
                      </div>
                      {alts.length > 0 && (
                        <p className="mt-1 text-xs text-ink-500">
                          次はこれも: {alts.join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="pill">{uv.totalCount}回使用</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="heading-serif text-2xl font-semibold">最近のセッション</h2>
          {recentSessions.length === 0 ? (
            <p className="mt-3 text-sm text-ink-500">まだセッションがありません。</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {recentSessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{s.scenario.name}</div>
                    <div className="text-xs text-ink-500">
                      {formatDate(s.endedAt)} · {s.totalTurns}ターン
                    </div>
                  </div>
                  <Link
                    href={`/result/${s.id}`}
                    className="btn-ghost text-xs"
                  >
                    振り返る →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
