import { NextRequest, NextResponse } from "next/server";
import { getApiKeyStatus, setApiKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getApiKeyStatus();
  return NextResponse.json(status);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { openaiKey?: string };

  if ("openaiKey" in body) {
    await setApiKey(body.openaiKey?.trim() ?? "");
  }

  const status = await getApiKeyStatus();
  return NextResponse.json(status);
}
