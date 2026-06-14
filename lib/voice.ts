export const TTS_MODELS = [
  { id: "tts-1", label: "標準 (tts-1)", hint: "高速・低コスト" },
  { id: "tts-1-hd", label: "高品質 (tts-1-hd)", hint: "より自然な音声" },
] as const;

export const TTS_VOICES = [
  { id: "alloy", label: "Alloy", hint: "中性的・落ち着き" },
  { id: "echo", label: "Echo", hint: "男性的・明瞭" },
  { id: "fable", label: "Fable", hint: "温かみ・物語調" },
  { id: "onyx", label: "Onyx", hint: "低音・重厚" },
  { id: "nova", label: "Nova", hint: "活発・明るい" },
  { id: "shimmer", label: "Shimmer", hint: "優しい・女性的" },
] as const;

export const TTS_SPEEDS = [
  { id: "slow",        label: "遅い",     value: 0.75  },
  { id: "slowish",     label: "少し遅い", value: 0.875 },
  { id: "normal",      label: "普通",     value: 1.0   },
  { id: "fastish",     label: "少し早い", value: 1.25  },
  { id: "fast",        label: "早い",     value: 1.5   },
] as const;

export type TtsModelId = (typeof TTS_MODELS)[number]["id"];
export type TtsVoiceId = (typeof TTS_VOICES)[number]["id"];
export type TtsSpeedId = (typeof TTS_SPEEDS)[number]["id"];

export interface VoiceSettings {
  ttsModel: TtsModelId;
  ttsVoice: TtsVoiceId;
  ttsSpeed: TtsSpeedId;
  autoPlay: boolean;
  autoSend: boolean;
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  ttsModel: "tts-1",
  ttsVoice: "nova",
  ttsSpeed: "normal",
  autoPlay: true,
  autoSend: true,
};

export const ALLOWED_MODELS = new Set(TTS_MODELS.map((m) => m.id));
export const ALLOWED_VOICES = new Set(TTS_VOICES.map((v) => v.id));
export const ALLOWED_SPEEDS = new Set(TTS_SPEEDS.map((s) => s.id));
