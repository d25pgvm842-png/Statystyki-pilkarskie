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

  const previousSeason = await prisma.season.findFirst({
    where: {
      leagueId: season.leagueId,
      startsAt: { lt: season.startsAt },
    },
    select: { id: true, name: true },
    orderBy: { startsAt: "desc" },
  });

  const historySeasonIds = previousSeason
    ? [previousSeason.id, season.id]
    : [season.id];
  const historySeasonNames = previousSeason
    ? [previousSeason.name, season.name]
    : [season.name];

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
        seasonId: { in: historySeasonIds },
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
    historySeasonNames,
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
