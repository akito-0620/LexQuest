"use client";

import clsx from "clsx";
import { TTS_MODELS, TTS_VOICES, TTS_SPEEDS, type VoiceSettings } from "@/lib/voice";

interface Props {
  settings: VoiceSettings;
  onChange: (patch: Partial<VoiceSettings>) => void;
  onPreview: () => void;
  isSpeaking: boolean;
}

export default function VoiceSettingsPanel({ settings, onChange, onPreview, isSpeaking }: Props) {
  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="heading-serif text-lg font-semibold">音声設定</h2>
        <button
          type="button"
          onClick={onPreview}
          disabled={isSpeaking}
          className="text-[11px] font-semibold text-ink-500 underline-offset-2 hover:text-ink-900 hover:underline disabled:opacity-50"
        >
          {isSpeaking ? "再生中…" : "▶ 声をプレビュー"}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <Toggle
          label="AI返答を自動再生"
          checked={settings.autoPlay}
          onChange={(v) => onChange({ autoPlay: v })}
        />
        <Toggle
          label="録音後に自動送信"
          checked={settings.autoSend}
          onChange={(v) => onChange({ autoSend: v })}
        />

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            話す速度
          </div>
          <div className="flex gap-1">
            {TTS_SPEEDS.map((s) => {
              const active = settings.ttsSpeed === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onChange({ ttsSpeed: s.id })}
                  className={clsx(
                    "flex-1 rounded-lg border py-2 text-xs font-medium transition",
                    active
                      ? "border-quest-gold bg-quest-gold/10 font-semibold"
                      : "border-parchment-200 bg-white/70 text-ink-700 hover:bg-white",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            音声モデル
          </div>
          <div className="flex flex-col gap-1.5">
            {TTS_MODELS.map((m) => {
              const active = settings.ttsModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onChange({ ttsModel: m.id })}
                  className={clsx(
                    "flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
                    active
                      ? "border-quest-gold bg-quest-gold/10 font-semibold"
                      : "border-parchment-200 bg-white/70 text-ink-700 hover:bg-white",
                  )}
                >
                  <span>{m.label}</span>
                  <span className="text-[11px] text-ink-500">{m.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
            声のキャラクター
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {TTS_VOICES.map((v) => {
              const active = settings.ttsVoice === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ ttsVoice: v.id })}
                  className={clsx(
                    "flex flex-col items-start rounded-lg border px-3 py-2 text-left transition",
                    active
                      ? "border-quest-gold bg-quest-gold/10"
                      : "border-parchment-200 bg-white/70 text-ink-700 hover:bg-white",
                  )}
                >
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className="text-[10px] text-ink-500">{v.hint}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-quest-emerald" : "bg-parchment-200",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
