import { NextRequest, NextResponse } from "next/server";
import { getApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = await getApiKey("openai");
  if (!apiKey) {
    return NextResponse.json({ error: "OpenAI API key not set" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!audio || typeof audio === "string") {
    return NextResponse.json({ error: "audio file required" }, { status: 400 });
  }

  const oaiForm = new FormData();
  oaiForm.append("file", audio, (audio as File).name ?? "audio.webm");
  oaiForm.append("model", "whisper-1");
  oaiForm.append("language", "en");

  try {
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: oaiForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Whisper error:", errText);
      return NextResponse.json({ error: errText }, { status: 502 });
    }

    const data = (await res.json()) as { text: string };
    return NextResponse.json({ text: data.text.trim() });
  } catch (e) {
    console.error("STT network error:", e);
    return NextResponse.json({ error: "network error" }, { status: 500 });
  }
}
