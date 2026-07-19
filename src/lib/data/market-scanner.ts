import { prisma } from "@/lib/db";
import {
  scanUpcomingMarket,
} from "@/lib/stats/market-scanner";
import {
  type BacktestLookback,
  type BacktestSide,
} from "@/lib/stats/market-backtest";
import type { TrendStatKey } from "@/lib/stats/trends";

export async function loadMarketScanner(input: {
  seasonId: string;
  statKey: TrendStatKey;
  threshold: number;
  side: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
  days: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const until = new Date(now);
  until.setUTCDate(until.getUTCDate() + input.days);

  const season = await prisma.season.findUnique({
    where: { id: input.seasonId },
    include: { league: true },
  });
  if (!season) return null;

  const matchSelect = {
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
  } as const;

  const [finishedMatches, upcomingMatches] = await Promise.all([
    prisma.match.findMany({
      where: {
        seasonId: input.seasonId,
        status: "FINISHED",
        kickoffAt: { lt: until },
      },
      select: matchSelect,
      orderBy: { kickoffAt: "asc" },
    }),
    prisma.match.findMany({
      where: {
        seasonId: input.seasonId,
        status: "SCHEDULED",
        kickoffAt: { gte: now, lte: until },
      },
      select: matchSelect,
      orderBy: { kickoffAt: "asc" },
    }),
  ]);

  return {
    season,
    now,
    until,
    summary: scanUpcomingMarket({
      finishedMatches,
      upcomingMatches,
      statKey: input.statKey,
      threshold: input.threshold,
      side: input.side,
      lookback: input.lookback,
      minSample: input.minSample,
      minEdge: input.minEdge,
    }),
  };
}
