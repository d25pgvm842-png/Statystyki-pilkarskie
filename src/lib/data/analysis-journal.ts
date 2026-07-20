import { prisma } from "@/lib/db";
import { summarizeJournal } from "@/lib/stats/analysis-journal";

export async function loadAnalysisJournal(input: {
  userId: string;
  seasonId?: string | null;
  status?: string | null;
  statKey?: string | null;
}) {
  const items = await prisma.analysisPick.findMany({
    where: {
      userId: input.userId,
      ...(input.seasonId ? { match: { seasonId: input.seasonId } } : {}),
      ...(input.status ? { status: input.status as never } : {}),
      ...(input.statKey ? { statKey: input.statKey } : {}),
    },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          season: { include: { league: true } },
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { match: { kickoffAt: "desc" } },
      { createdAt: "desc" },
    ],
  });

  const metrics = summarizeJournal(items.map((item) => ({
    status: item.status,
    result: item.result,
    odds: item.odds,
    closingOdds: item.closingOdds,
    stake: item.stake,
  })));

  return { items, metrics };
}
