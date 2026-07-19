import { prisma } from "@/lib/db";
import {
  runMarketBacktest,
  type BacktestLookback,
  type BacktestSide,
} from "@/lib/stats/market-backtest";
import type { TrendStatKey } from "@/lib/stats/trends";

export async function loadMarketBacktest(input: {
  seasonId: string;
  statKey: TrendStatKey;
  threshold: number;
  side: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
}) {
  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    include: { league: true },
  });
  if (!season) return null;

  const matches = await prisma.match.findMany({
    where: {
      seasonId: input.seasonId,
      status: "FINISHED",
    },
    select: {
      id: true,
      kickoffAt: true,
      round: true,
      homeTeamId: true,
      awayTeamId: true,
      homeScore: true,
      awayScore: true,
      stats: true,
      homeTeam: { select: { id: true, name: true } },
      awayTeam: { select: { id: true, name: true } },
    },
    orderBy: { kickoffAt: "asc" },
  });

  return {
    season,
    summary: runMarketBacktest({
      matches,
      statKey: input.statKey,
      threshold: input.threshold,
      side: input.side,
      lookback: input.lookback,
      minSample: input.minSample,
      minEdge: input.minEdge,
    }),
  };
}
