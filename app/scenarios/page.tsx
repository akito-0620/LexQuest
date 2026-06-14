import { prisma } from "@/lib/db";
import { safeJsonArray } from "@/lib/session-summary";
import { QUEST_BY_SLUG } from "@/lib/quest-engine";
import { FUNCTION_LABELS } from "@/lib/vocabulary-dictionary";
import StartScenarioButton from "./StartScenarioButton";

export const dynamic = "force-dynamic";

export default async function ScenariosPage() {
  const scenarios = await prisma.scenario.findMany({ orderBy: { createdAt: "asc" } });
  const data = scenarios.map((s) => {
    const fns = safeJsonArray(s.focusFunctions);
    const recQuests = safeJsonArray(s.recommendedQuestSlugs)
      .map((slug) => QUEST_BY_SLUG.get(slug))
      .filter((q): q is NonNullable<typeof q> => q != null);
    return {
      slug: s.slug,
      name: s.name,
      description: s.description,
      goal: s.goal,
      focusFunctions: fns,
      recommendedQuests: recQuests,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="heading-serif text-4xl font-semibold">シナリオを選ぶ</h1>
        <p className="max-w-2xl text-ink-700">
          シナリオごとに出会う表現の傾向が変わります。1つ選んで話し始めると、図鑑が少しずつ埋まっていきます。
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {data.map((s, idx) => (
          <article
            key={s.slug}
            className="panel relative flex flex-col gap-4 overflow-hidden p-6"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20"
              style={{
                background: [
                  "radial-gradient(circle, #c39a2b, transparent 70%)",
                  "radial-gradient(circle, #2f8f6a, transparent 70%)",
                  "radial-gradient(circle, #3964a7, transparent 70%)",
                ][idx % 3],
              }}
            />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="pill">シナリオ {idx + 1}</span>
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  重点 {s.focusFunctions.length} 項目
                </span>
              </div>
              <h2 className="heading-serif text-2xl font-semibold">{s.name}</h2>
              <p className="text-sm text-ink-700">{s.description}</p>
            </div>

            <div className="panel-tight p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                ゴール
              </div>
              <p className="mt-1 text-sm">{s.goal}</p>
            </div>

            {s.focusFunctions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {s.focusFunctions.map((f) => {
                  const label = FUNCTION_LABELS[f];
                  return (
                    <span key={f} className="chip chip-function">
                      {label?.ja ?? f}
                    </span>
                  );
                })}
              </div>
            )}

            {s.recommendedQuests.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
                  おすすめクエスト
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {s.recommendedQuests.map((q) => (
                    <li key={q.slug}>
                      <span className="text-ink-700">• {q.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-auto pt-2">
              <StartScenarioButton scenarioSlug={s.slug} scenarioName={s.name} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
