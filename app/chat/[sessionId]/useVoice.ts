"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_VOICE_SETTINGS, type VoiceSettings } from "@/lib/voice";

const STORAGE_KEY = "lexquest-voice-v1";

function loadSettings(): VoiceSettings {
  if (typeof window === "undefined") return DEFAULT_VOICE_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

function persist(s: VoiceSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const t of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ]) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function extFromMime(mime: string): string {
  if (mime.includes("mp4")) return "mp4";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

export function useVoice() {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const updateSettings = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, overrideSettings?: Partial<VoiceSettings>) => {
      stopSpeaking();
      if (!text.trim()) return;
      const s = overrideSettings ? { ...settings, ...overrideSettings } : settings;
      setIsSpeaking(true);
      setVoiceError(null);
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text, model: s.ttsModel, voice: s.ttsVoice, speed: s.ttsSpeed }),
        });
        if (!res.ok) {
          const e = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(e.error ?? "音声生成に失敗しました");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          blobUrlRef.current = null;
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          setVoiceError("音声の再生に失敗しました");
        };
        await audio.play();
      } catch (e) {
        setIsSpeaking(false);
        if (e instanceof Error && e.name !== "AbortError") {
          setVoiceError(e.message);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.ttsModel, settings.ttsVoice, stopSpeaking],
  );

  const startRecording = useCallback(async (): Promise<boolean> => {
    setVoiceError(null);
    stopSpeaking();
    const mimeType = getSupportedMimeType();
    if (!mimeType) {
      setVoiceError("このブラウザは録音に対応していません（Chrome / Edge を推奨）");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(100);
      mrRef.current = mr;
      setIsRecording(true);
      return true;
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "マイクへのアクセスを許可してください"
          : "録音を開始できませんでした";
      setVoiceError(msg);
      return false;
    }
  }, [stopSpeaking]);

  const stopRecording = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const mr = mrRef.current;
      if (!mr || mr.state === "inactive") {
        setIsRecording(false);
        reject(new Error("録音中ではありません"));
        return;
      }
      mr.onstop = async () => {
        mr.stream.getTracks().forEach((t) => t.stop());
        mrRef.current = null;
        setIsRecording(false);
        const mimeType = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 500) {
          reject(new Error("録音が短すぎます。もう少し話してください。"));
          return;
        }
        setIsTranscribing(true);
        setVoiceError(null);
        try {
          const fd = new FormData();
          fd.append("audio", blob, `recording.${extFromMime(mimeType)}`);
          const res = await fetch("/api/voice/stt", { method: "POST", body: fd });
          if (!res.ok) {
            const e = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(e.error ?? "文字起こしに失敗しました");
          }
          const data = (await res.json()) as { text: string };
          const text = data.text.trim();
          setIsTranscribing(false);
          if (!text) {
            reject(new Error("音声を認識できませんでした。もう一度お試しください。"));
          } else {
            resolve(text);
          }
        } catch (e) {
          setIsTranscribing(false);
          const msg = e instanceof Error ? e.message : "文字起こしエラー";
          setVoiceError(msg);
          reject(e);
        }
      };
      mr.stop();
    });
  }, []);

  return {
    settings,
    updateSettings,
    isRecording,
    isTranscribing,
    isSpeaking,
    voiceError,
    speak,
    stopSpeaking,
    startRecording,
    stopRecording,
  };
}
