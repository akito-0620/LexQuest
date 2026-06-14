"use client";

import { useEffect, useState } from "react";

interface KeyStatus {
  hasOpenAI: boolean;
  openaiPreview: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<KeyStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setStatus);
  }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openaiKey: value }),
    });
    const next = await res.json();
    setStatus(next);
    setSaving(false);
    setEditing(false);
    setValue("");
    setSavedMsg("保存しました");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  async function remove() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openaiKey: "" }),
    });
    const next = await res.json();
    setStatus(next);
    setSaving(false);
    setSavedMsg("削除しました");
    setTimeout(() => setSavedMsg(""), 2500);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="heading-serif text-3xl font-semibold text-ink-900">設定</h1>
        <p className="mt-2 text-sm text-ink-500">
          OpenAI API Keyを設定すると、AIとのリアルな英会話・音声機能（STT/TTS）が使えます。
          未設定でもスクリプト返答モードで全機能を試せます。
        </p>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          {savedMsg}
        </div>
      )}

      {status === null ? (
        <p className="text-sm text-ink-400">読み込み中…</p>
      ) : (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-ink-400">
            APIキー
          </h2>

          <div className="rounded-xl border border-parchment-200 bg-white p-5 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className="font-serif font-semibold text-ink-900">OpenAI API Key</span>
              {status.hasOpenAI ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  設定済み {status.openaiPreview}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  未設定
                </span>
              )}
            </div>
            <p className="mb-3 text-sm text-ink-500">
              AIとのリアルな会話返答（GPT-4o mini）と音声機能（Whisper STT / TTS）に使用します。
            </p>

            {editing ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  autoFocus
                  placeholder="sk-... を貼り付け"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save();
                    if (e.key === "Escape") { setEditing(false); setValue(""); }
                  }}
                  className="flex-1 rounded-lg border border-parchment-300 bg-parchment-50 px-3 py-2 text-sm font-mono text-ink-800 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none"
                />
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white hover:bg-ink-700 disabled:opacity-50"
                >
                  保存
                </button>
                <button
                  onClick={() => { setEditing(false); setValue(""); }}
                  className="rounded-lg border border-parchment-300 px-4 py-2 text-sm text-ink-600 hover:bg-parchment-50"
                >
                  キャンセル
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-parchment-300 px-4 py-2 text-sm text-ink-700 hover:bg-parchment-50"
                >
                  {status.hasOpenAI ? "変更する" : "入力する"}
                </button>
                {status.hasOpenAI && (
                  <button
                    onClick={remove}
                    disabled={saving}
                    className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    削除
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
