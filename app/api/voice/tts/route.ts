import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_MODELS, ALLOWED_VOICES, ALLOWED_SPEEDS, TTS_SPEEDS } from "@/lib/voice";
import { getApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = await getApiKey("openai");
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not set" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as {
    text?: string;
    model?: string;
    voice?: string;
    speed?: string;
  };

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }

  const model = ALLOWED_MODELS.has(body.model as never) ? body.model! : "tts-1";
  const voice = ALLOWED_VOICES.has(body.voice as never) ? body.voice! : "nova";
  const speedId = ALLOWED_SPEEDS.has(body.speed as never) ? body.speed! : "normal";
  const speed = TTS_SPEEDS.find((s) => s.id === speedId)?.value ?? 1.0;

  try {
    const res = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, voice, input: text, speed }),
    });

    if (!res.ok) {
      console.error("TTS error:", await res.text());
      return NextResponse.json({ error: "tts failed" }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("TTS network error:", e);
    return NextResponse.json({ error: "network error" }, { status: 500 });
  }
}
