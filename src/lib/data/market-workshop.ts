import { prisma } from "@/lib/db";
import {
  buildMarketWorkshop,
  type MarketWorkshopTarget,
} from "@/lib/stats/market-workshop";
import type { RatingLookback } from "@/lib/stats/market-ratings";
import type { TrendStatKey } from "@/lib/stats/trends";

export async function loadMarketWorkshop(input: {
  matchId: string;
  statKey: TrendStatKey;
  target: MarketWorkshopTarget;
  line: number;
  lookback: RatingLookback;
  overOdds?: number | null;
  underOdds?: number | null;
}) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
      season: {
        include: {
          league: true,
          teams: {
            include: { team: true },
            orderBy: { team: { name: "asc" } },
          },
        },
      },
    },
  });
  if (!match) return null;

  const matches = await prisma.match.findMany({
    where: {
      seasonId: match.seasonId,
      status: "FINISHED",
      kickoffAt: { lt: match.kickoffAt },
    },
    select: {
      id: true,
      kickoffAt: true,
      homeTeamId: true,
      awayTeamId: true,
      stats: true,
    },
    orderBy: { kickoffAt: "desc" },
  });

  const teams = match.season.teams.map((membership: {
    team: { id: string; name: string; shortName: string | null };
  }) => ({
    id: membership.team.id,
    name: membership.team.name,
    shortName: membership.team.shortName,
  }));

  return {
    match,
    workshop: buildMarketWorkshop({
      teams,
      matches,
      statKey: input.statKey,
      target: input.target,
      line: input.line,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      lookback: input.lookback,
      minSample: 3,
      before: match.kickoffAt,
      overOdds: input.overOdds,
      underOdds: input.underOdds,
    }),
  };
}
