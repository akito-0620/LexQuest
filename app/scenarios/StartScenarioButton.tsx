"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartScenarioButton({
  scenarioSlug,
  scenarioName,
}: {
  scenarioSlug: string;
  scenarioName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenarioSlug }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "セッションを開始できませんでした");
      }
      const data = await res.json();
      router.push(`/chat/${data.sessionId}`);
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : "不明なエラー";
      setError(err);
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="btn-primary w-full"
        aria-label={`${scenarioName}を始める`}
      >
        {loading ? "開始中..." : "会話を始める →"}
      </button>
      {error && <p className="text-xs text-quest-ruby">{error}</p>}
    </div>
  );
}
