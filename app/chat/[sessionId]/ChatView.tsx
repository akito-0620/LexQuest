"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useVoice } from "./useVoice";
import VoiceSettingsPanel from "./VoiceSettingsPanel";

type Role = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: Role;
  content: string;
}

interface TurnItem {
  displayText: string;
  category: string;
  isNew: boolean;
  leveledUp: boolean;
  newLevel: number;
  xpAwarded: number;
  meaningGroup?: string | null;
  functionType?: string | null;
}

interface QuestItem {
  slug: string;
  title: string;
  description: string;
  type: string;
  progress: number;
  target: number;
  completed: boolean;
  rewardXp: number;
}

interface ScenarioInfo {
  slug: string;
  name: string;
  description: string;
  goal: string;
  focusFunctions: { slug: string; label: string }[];
}

const CATEGORY_CLASS: Record<string, string> = {
  word: "chip-word",
  expression: "chip-expression",
  phrase: "chip-phrase",
  function: "chip-function",
};

const CATEGORY_JA: Record<string, string> = {
  word: "単語",
  expression: "表現",
  phrase: "フレーズ",
  function: "機能",
};

export default function ChatView({
  sessionId,
  scenario,
  initialMessages,
  initialQuests,
  ended,
}: {
  sessionId: string;
  scenario: ScenarioInfo;
  initialMessages: ChatMessage[];
  initialQuests: QuestItem[];
  ended: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [quests, setQuests] = useState<QuestItem[]>(initialQuests);
  const [recentItems, setRecentItems] = useState<TurnItem[]>([]);
  const [newItemCount, setNewItemCount] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEnded, setIsEnded] = useState(ended);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const {
    settings: voiceSettings,
    updateSettings,
    isRecording,
    isTranscribing,
    isSpeaking,
    voiceError,
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
  } = useVoice();

  // Keep a ref to autoPlay so sendContent can read latest value without being in deps
  const autoPlayRef = useRef(voiceSettings.autoPlay);
  autoPlayRef.current = voiceSettings.autoPlay;

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Clear speakingMsgId when TTS stops
  useEffect(() => {
    if (!isSpeaking) setSpeakingMsgId(null);
  }, [isSpeaking]);

  const turnCount = useMemo(() => messages.filter((m) => m.role === "user").length, [messages]);

  const sendContent = useCallback(
    async (content: string) => {
      if (!content.trim() || sending || isEnded) return;
      setSending(true);
      setError(null);
      const optimistic: ChatMessage = { id: `temp-${Date.now()}`, role: "user", content };
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/messages`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ content }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error((e as { error?: string }).error ?? "送信に失敗しました");
        }
        const data = (await res.json()) as {
          userMessage: { id: string; content: string };
          assistantMessage: { id: string; content: string };
          turn?: { totalXpGained?: number; items?: TurnItem[] };
          quests?: QuestItem[];
        };
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimistic.id);
          return [
            ...withoutOptimistic,
            { id: data.userMessage.id, role: "user", content: data.userMessage.content },
            {
              id: data.assistantMessage.id,
              role: "assistant",
              content: data.assistantMessage.content,
            },
          ];
        });
        if (autoPlayRef.current) {
          setSpeakingMsgId(data.assistantMessage.id);
          speak(data.assistantMessage.content).catch(() => setSpeakingMsgId(null));
        }
        if (Array.isArray(data.turn?.items)) {
          setRecentItems((prev) => [...(data.turn!.items!), ...prev].slice(0, 8));
          const newItems = (data.turn!.items!).filter((it) => it.isNew).length;
          if (newItems > 0) setNewItemCount((x) => x + newItems);
          setSessionXp((x) => x + (data.turn!.totalXpGained ?? 0));
        }
        if (Array.isArray(data.quests)) setQuests(data.quests);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "不明なエラー");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      } finally {
        setSending(false);
        inputRef.current?.focus();
      }
    },
    [sending, sessionId, isEnded, speak],
  );

  const send = useCallback(async () => {
    const content = input.trim();
    if (!content) return;
    setInput("");
    await sendContent(content);
  }, [input, sendContent]);

  const endSession = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
      if (!res.ok) throw new Error("セッションを終了できませんでした");
      setIsEnded(true);
      router.push(`/result/${sessionId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "不明なエラー");
      setEnding(false);
    }
  }, [ending, router, sessionId]);

  const handleMicClick = useCallback(async () => {
    if (isRecording) {
      try {
        const text = await stopRecording();
        if (voiceSettings.autoSend) {
          await sendContent(text);
        } else {
          setInput(text);
          inputRef.current?.focus();
        }
      } catch {
        // error shown via voiceError
      }
    } else {
      await startRecording();
    }
  }, [isRecording, stopRecording, startRecording, voiceSettings.autoSend, sendContent]);

  const handleSpeak = useCallback(
    (msgId: string, text: string) => {
      if (isSpeaking && speakingMsgId === msgId) {
        stopSpeaking();
      } else {
        setSpeakingMsgId(msgId);
        speak(text).catch(() => setSpeakingMsgId(null));
      }
    },
    [isSpeaking, speakingMsgId, speak, stopSpeaking],
  );

  const handlePreviewVoice = useCallback(() => {
    speak("Hello! Nice to meet you. How are you today?");
  }, [speak]);

  const hint = useMemo(() => {
    const incomplete = quests.find((q) => !q.completed);
    if (!incomplete) return "今日のクエストは全て達成！このまま続ければ追加XPがもらえます。";
    if (incomplete.type === "new")
      return "まだここで使ったことのない単語を1つ混ぜてみましょう。";
    if (incomplete.type === "variation") {
      const m = incomplete.title.match(/'([^']+)'/);
      const target = m ? m[1] : "いつもの言い方";
      return `"${target}" の代わりに別の言い方を試してみましょう。`;
    }
    if (incomplete.type === "function")
      return `「${incomplete.title}」を試してみましょう。`;
    return "もう1ターン続けてみましょう — 図鑑がまた育ちます。";
  }, [quests]);

  const isVoiceActive = isRecording || isTranscribing;
  const combinedError = error ?? voiceError;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      {/* ── Chat area ── */}
      <section className="panel flex h-[calc(100vh-160px)] min-h-[560px] flex-col overflow-hidden md:h-[calc(100vh-200px)]">
        <header className="flex items-center justify-between gap-2 border-b border-parchment-200 px-5 py-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              シナリオ
            </div>
            <div className="font-serif text-lg font-semibold">{scenario.name}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="pill">{turnCount}ターン</span>
            <button
              type="button"
              onClick={endSession}
              disabled={ending || turnCount === 0}
              className="btn-secondary text-xs"
            >
              {ending ? "終了中..." : "セッション終了"}
            </button>
          </div>
        </header>

        <div
          ref={listRef}
          className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
          aria-live="polite"
        >
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              role={m.role}
              content={m.content}
              isPlaying={speakingMsgId === m.id && isSpeaking}
              onSpeak={m.role === "assistant" ? () => handleSpeak(m.id, m.content) : undefined}
            />
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-sm text-ink-500">
              <DotSpinner /> 考え中...
            </div>
          )}
        </div>

        <footer className="border-t border-parchment-200 px-5 py-3">
          {combinedError && (
            <p className="mb-2 text-xs text-quest-ruby" role="alert">
              {combinedError}
            </p>
          )}
          {isTranscribing && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-ink-500">
              <DotSpinner /> 音声を認識中...
            </p>
          )}
          <div className="flex items-end gap-2">
            {/* Mic button */}
            <button
              type="button"
              onClick={handleMicClick}
              disabled={isEnded || sending || isTranscribing}
              title={isRecording ? "録音を停止" : "マイクで話す"}
              className={clsx(
                "relative flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-xl border transition",
                isRecording
                  ? "border-quest-ruby bg-quest-ruby text-white"
                  : "border-parchment-200 bg-white/80 text-ink-700 hover:bg-white disabled:opacity-50",
              )}
            >
              {isRecording && (
                <span className="absolute inset-0 animate-ping rounded-xl bg-quest-ruby opacity-25" />
              )}
              {isRecording ? <IconStop /> : <IconMic />}
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              disabled={isEnded || sending || isRecording || isTranscribing}
              placeholder={
                isEnded
                  ? "セッション終了済み。振り返りは結果ページから。"
                  : isRecording
                    ? "録音中... もう一度押すと停止します"
                    : isTranscribing
                      ? "認識中..."
                      : "思いついた英語を自由に入力..."
              }
              rows={2}
              className="min-h-[48px] flex-1 resize-none rounded-xl border border-parchment-200 bg-white/90 px-3 py-2 text-sm shadow-inset outline-none focus:border-quest-gold disabled:opacity-60"
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending || isEnded || input.trim().length === 0}
                className="btn-primary h-[38px] px-4 text-sm"
              >
                送信
              </button>
              {/* Voice settings toggle */}
              <button
                type="button"
                onClick={() => setShowVoiceSettings((v) => !v)}
                title="音声設定"
                className={clsx(
                  "flex h-[38px] items-center justify-center rounded-full border px-3 text-xs font-semibold transition",
                  showVoiceSettings
                    ? "border-quest-gold bg-quest-gold/10 text-quest-gold"
                    : "border-parchment-200 bg-white/70 text-ink-500 hover:bg-white",
                )}
              >
                {isSpeaking ? <IconSpeaker /> : "音声設定"}
              </button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-500">
            Enterで送信 · Shift+Enterで改行 ·
            <span className="ml-1">🎤 マイクボタンで話す</span>
          </p>
        </footer>
      </section>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col gap-4">
        <section className="panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-serif text-lg font-semibold">クエスト</h2>
            <span className="pill text-[10px]">
              {quests.filter((q) => q.completed).length}/{quests.length}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {quests.map((q) => {
              const ratio = Math.min(1, q.progress / Math.max(1, q.target));
              return (
                <li
                  key={q.slug}
                  className={clsx(
                    "panel-tight p-3 transition",
                    q.completed && "animate-glow border-quest-gold/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={clsx(
                            "chip",
                            q.completed
                              ? "bg-quest-emerald/15 text-quest-emerald"
                              : "bg-parchment-200 text-ink-700",
                          )}
                        >
                          {q.completed ? "✓ 達成" : "挑戦中"}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                          +{q.rewardXp}
                        </span>
                      </div>
                      <p className="mt-1 font-serif text-sm font-semibold leading-tight">
                        {q.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-500">{q.description}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="xp-bar flex-1">
                      <span
                        style={{ width: `${ratio * 100}%` }}
                        className={clsx(q.completed && "!bg-quest-emerald")}
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
        </section>

        <section className="panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="heading-serif text-lg font-semibold">このセッション</h2>
            <span className="pill text-[10px]">+{sessionXp} XP</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="panel-tight px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-500">ターン</div>
              <div className="font-serif text-xl font-semibold">{turnCount}</div>
            </div>
            <div className="panel-tight px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-500">新規</div>
              <div className="font-serif text-xl font-semibold">{newItemCount}</div>
            </div>
            <div className="panel-tight px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-ink-500">XP</div>
              <div className="font-serif text-xl font-semibold">{sessionXp}</div>
            </div>
          </div>
          {recentItems.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {recentItems.slice(0, 5).map((it, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={CATEGORY_CLASS[it.category] ?? "chip"}>
                      {CATEGORY_JA[it.category] ?? it.category}
                    </span>
                    <span className="truncate font-medium">{it.displayText}</span>
                    {it.isNew && (
                      <span className="chip bg-quest-gold/15 text-quest-gold">新規</span>
                    )}
                    {it.leveledUp && (
                      <span className="chip bg-quest-emerald/15 text-quest-emerald">
                        Lv.{it.newLevel}
                      </span>
                    )}
                  </div>
                  <span className="text-ink-500">+{it.xpAwarded}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-4">
          <h2 className="heading-serif text-lg font-semibold">ヒント</h2>
          <p className="mt-1 text-sm text-ink-700">{hint}</p>
          {scenario.focusFunctions.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                このシナリオの重点
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {scenario.focusFunctions.map((f) => (
                  <span key={f.slug} className="chip chip-function">
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {showVoiceSettings && (
          <VoiceSettingsPanel
            settings={voiceSettings}
            onChange={updateSettings}
            onPreview={handlePreviewVoice}
            isSpeaking={isSpeaking}
          />
        )}
      </aside>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  isPlaying,
  onSpeak,
}: {
  role: Role;
  content: string;
  isPlaying?: boolean;
  onSpeak?: () => void;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[78%] rounded-2xl rounded-br-sm bg-ink-900 px-4 py-2.5 text-parchment-50 shadow-panel animate-fade-slide-up">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-quest-gold/20 font-serif text-sm font-semibold text-quest-gold">
        A
      </span>
      <div className="group max-w-[78%]">
        <div className="rounded-2xl rounded-tl-sm border border-parchment-200 bg-white/90 px-4 py-2.5 shadow-panel animate-fade-slide-up">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        </div>
        {onSpeak && (
          <button
            type="button"
            onClick={onSpeak}
            title={isPlaying ? "再生を停止" : "この文を読み上げる"}
            className={clsx(
              "mt-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition",
              isPlaying
                ? "bg-quest-sapphire/15 text-quest-sapphire"
                : "text-ink-500 opacity-0 hover:bg-parchment-100 hover:text-ink-900 group-hover:opacity-100",
            )}
          >
            {isPlaying ? "■ 停止" : "▶ 再生"}
          </button>
        )}
      </div>
    </div>
  );
}

function DotSpinner() {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-500 [animation-delay:-0.25s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-500 [animation-delay:-0.125s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-500" />
    </span>
  );
}

function IconMic() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm-1.5 17.93A8.001 8.001 0 0 1 4 12H2a10 10 0 0 0 9 9.95V24h2v-2.05A10 10 0 0 0 22 12h-2a8 8 0 0 1-6.5 6.93V19h-3v-0.07z" />
    </svg>
  );
}

function IconStop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  );
}

function IconSpeaker() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}
