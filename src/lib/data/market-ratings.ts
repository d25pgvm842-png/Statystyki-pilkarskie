import { prisma } from "@/lib/db";
import {
  buildMarketRatings,
  buildTeamMarketProfile,
  type RatingLookback,
  type RatingScope,
  type RatingVenue,
} from "@/lib/stats/market-ratings";
import type { TrendStatKey } from "@/lib/stats/trends";

async function loadSeasonDataset(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      league: true,
      teams: {
        include: { team: true },
        orderBy: { team: { name: "asc" } },
      },
    },
  });
  if (!season) return null;

  const matches = await prisma.match.findMany({
    where: {
      seasonId,
      status: "FINISHED",
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

  return {
    season,
    teams: season.teams.map((membership) => ({
      id: membership.team.id,
      name: membership.team.name,
      shortName: membership.team.shortName,
    })),
    matches,
  };
}

export async function loadMarketRatings(input: {
  seasonId: string;
  statKey: TrendStatKey;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample: number;
  before?: Date | string | null;
}) {
  const dataset = await loadSeasonDataset(input.seasonId);
  if (!dataset) return null;

  return {
    season: dataset.season,
    ratings: buildMarketRatings({
      teams: dataset.teams,
      matches: dataset.matches,
      statKey: input.statKey,
      scope: input.scope,
      venue: input.venue,
      lookback: input.lookback,
      minSample: input.minSample,
      before: input.before,
    }),
  };
}

export async function loadTeamMarketProfile(input: {
  seasonId: string;
  teamId: string;
  lookback: RatingLookback;
  venue?: RatingVenue;
  minSample?: number;
  before?: Date | string | null;
}) {
  const dataset = await loadSeasonDataset(input.seasonId);
  if (!dataset) return [];

  return buildTeamMarketProfile({
    teams: dataset.teams,
    matches: dataset.matches,
    teamId: input.teamId,
    lookback: input.lookback,
    venue: input.venue,
    minSample: input.minSample,
    before: input.before,
  });
}
