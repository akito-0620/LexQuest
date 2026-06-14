import { NextRequest, NextResponse } from "next/server";
import { ensureSessionEnded } from "@/lib/end-session";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const summary = await ensureSessionEnded(params.id);
  if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(summary);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const summary = await ensureSessionEnded(params.id);
  if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(summary);
}
