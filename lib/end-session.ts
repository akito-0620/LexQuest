import { prisma } from "./db";
import { buildSessionSummary, type SessionSummary } from "./session-summary";
import { playerLevelFromXp } from "./xp";

export interface EndedSummary extends SessionSummary {
  playerXpGained: number;
}

/** Idempotent: if already ended, re-reads the stored summary. */
export async function ensureSessionEnded(sessionId: string): Promise<EndedSummary | null> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;

  if (session.endedAt && session.summaryJson) {
    try {
      return JSON.parse(session.summaryJson) as EndedSummary;
    } catch {
      // fall through and rebuild
    }
  }

  const summary = await buildSessionSummary(sessionId);
  if (!summary) return null;

  const sessionBonus = Math.min(30, summary.totalTurns * 4 + 5);
  const playerXpGained = sessionBonus + summary.questRewardXp;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  // Only award player XP the first time we end.
  if (!session.endedAt && user) {
    const newXp = user.playerXp + playerXpGained;
    const newLevel = playerLevelFromXp(newXp);
    await prisma.user.update({
      where: { id: user.id },
      data: { playerXp: newXp, playerLevel: newLevel },
    });
  }

  const full: EndedSummary = { ...summary, playerXpGained };
  await prisma.session.update({
    where: { id: session.id },
    data: {
      endedAt: session.endedAt ?? new Date(),
      summaryJson: JSON.stringify(full),
    },
  });

  return full;
}
