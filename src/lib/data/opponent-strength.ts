import { loadSeasonAnalysisDataset } from "@/lib/data/season-analysis-dataset";
import {
  buildOpponentStrengthProfile,
  type OpponentStrengthProfile,
} from "@/lib/stats/opponent-strength";
import type {
  RatingLookback,
  RatingScope,
  RatingVenue,
} from "@/lib/stats/market-ratings";
import {
  TREND_STAT_DEFINITIONS,
  type TrendStatKey,
} from "@/lib/stats/trends";

export async function loadTeamOpponentStrength(input: {
  seasonId: string;
  teamId: string;
  statKey: TrendStatKey;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample?: number;
}) {
  const dataset = await loadSeasonAnalysisDataset({
    seasonId: input.seasonId,
  });
  if (!dataset) return null;

  const team = dataset.teams.find((item) => item.id === input.teamId);
  if (!team) return null;

  return {
    season: dataset.season,
    team,
    report: buildOpponentStrengthProfile({
      teams: dataset.teams,
      matches: dataset.matches,
      teamId: input.teamId,
      statKey: input.statKey,
      scope: input.scope,
      venue: input.venue,
      lookback: input.lookback,
      minSample: input.minSample,
    }),
  };
}

export type MatchOpponentStrengthRow = {
  key: TrendStatKey;
  label: string;
  home: OpponentStrengthProfile;
  away: OpponentStrengthProfile;
};

export async function loadMatchOpponentStrength(input: {
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  before: Date | string;
  lookback: RatingLookback;
  minSample?: number;
}): Promise<MatchOpponentStrengthRow[]> {
  const dataset = await loadSeasonAnalysisDataset({
    seasonId: input.seasonId,
    before: input.before,
  });
  if (!dataset) return [];

  return TREND_STAT_DEFINITIONS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    home: buildOpponentStrengthProfile({
      teams: dataset.teams,
      matches: dataset.matches,
      teamId: input.homeTeamId,
      statKey: definition.key,
      scope: "TEAM_FOR",
      venue: "HOME",
      lookback: input.lookback,
      minSample: input.minSample,
      before: input.before,
      currentOpponentId: input.awayTeamId,
    }),
    away: buildOpponentStrengthProfile({
      teams: dataset.teams,
      matches: dataset.matches,
      teamId: input.awayTeamId,
      statKey: definition.key,
      scope: "TEAM_FOR",
      venue: "AWAY",
      lookback: input.lookback,
      minSample: input.minSample,
      before: input.before,
      currentOpponentId: input.homeTeamId,
    }),
  }));
}
