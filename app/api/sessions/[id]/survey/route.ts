import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const { ease, agency, motivation, confidence, reuseIntent, freeComment } = body;

  const toScore = (v: unknown) => {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    if (Number.isNaN(n)) return 4;
    return Math.min(7, Math.max(1, n));
  };

  const session = await prisma.session.findUnique({ where: { id: params.id } });
  if (!session) return NextResponse.json({ error: "not found" }, { status: 404 });

  const saved = await prisma.surveyResponse.upsert({
    where: { sessionId: params.id },
    update: {
      ease: toScore(ease),
      agency: toScore(agency),
      motivation: toScore(motivation),
      confidence: toScore(confidence),
      reuseIntent: toScore(reuseIntent),
      freeComment: typeof freeComment === "string" ? freeComment : null,
    },
    create: {
      sessionId: params.id,
      ease: toScore(ease),
      agency: toScore(agency),
      motivation: toScore(motivation),
      confidence: toScore(confidence),
      reuseIntent: toScore(reuseIntent),
      freeComment: typeof freeComment === "string" ? freeComment : null,
    },
  });

  return NextResponse.json({ ok: true, id: saved.id });
}
