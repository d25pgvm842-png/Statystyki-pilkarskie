import {
  buildMarketRatings,
  marketStrengthBucketLabel,
  type RatingLookback,
  type RatingMatch,
  type RatingQuality,
  type RatingScope,
  type RatingTeam,
  type RatingVenue,
  type StrengthBucket,
} from "@/lib/stats/market-ratings";
import {
  trendDefinition,
  type TrendStatKey,
} from "@/lib/stats/trends";

export type OpponentStrengthRow = {
  matchId: string;
  kickoffAt: Date;
  venue: Exclude<RatingVenue, "ALL">;
  opponentId: string;
  opponentName: string;
  opponentBucket: StrengthBucket | null;
  opponentRating: number | null;
  opponentSample: number;
  actual: number;
  expected: number | null;
  delta: number | null;
  baselineSample: number;
};

export type OpponentStrengthBucketRow = {
  bucket: StrengthBucket;
  label: string;
  matches: number;
  comparableMatches: number;
  rawAverage: number | null;
  expectedAverage: number | null;
  deltaAverage: number | null;
};

export type CurrentOpponentStrength = {
  teamId: string;
  bucket: StrengthBucket | null;
  rating: number | null;
  sample: number;
  quality: RatingQuality;
};

export type OpponentStrengthProfile = {
  statKey: TrendStatKey;
  statLabel: string;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample: number;
  sample: number;
  comparableSample: number;
  rawAverage: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  expectedAverage: number | null;
  leagueAverage: number | null;
  adjustment: number | null;
  adjustedAverage: number | null;
  quality: RatingQuality;
  currentOpponent: CurrentOpponentStrength | null;
  byBucket: OpponentStrengthBucketRow[];
  rows: OpponentStrengthRow[];
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function quality(sample: number): RatingQuality {
  if (sample === 0) return "NO_DATA";
  if (sample < 5) return "WEAK";
  if (sample < 10) return "MODERATE";
  return "STRONG";
}

function roleFor(match: RatingMatch, teamId: string) {
  if (match.homeTeamId === teamId) return "HOME" as const;
  if (match.awayTeamId === teamId) return "AWAY" as const;
  return null;
}

function oppositeVenue(venue: Exclude<RatingVenue, "ALL">) {
  return venue === "HOME" ? "AWAY" as const : "HOME" as const;
}

export function opponentRatingScope(scope: RatingScope): RatingScope {
  if (scope === "TEAM_FOR") return "TEAM_AGAINST";
  if (scope === "TEAM_AGAINST") return "TEAM_FOR";
  return "MATCH_TOTAL";
}

function valueFor(input: {
  match: RatingMatch;
  teamId: string;
  statKey: TrendStatKey;
  scope: RatingScope;
}) {
  const definition = trendDefinition(input.statKey);
  if (!definition || !input.match.stats) return null;
  const role = roleFor(input.match, input.teamId);
  if (!role) return null;

  const homeValue = input.match.stats[definition.home];
  const awayValue = input.match.stats[definition.away];
  if (input.scope === "MATCH_TOTAL") {
    return typeof homeValue === "number" && typeof awayValue === "number"
      ? homeValue + awayValue
      : null;
  }

  const teamValue = role === "HOME" ? homeValue : awayValue;
  const opponentValue = role === "HOME" ? awayValue : homeValue;
  const selected = input.scope === "TEAM_FOR" ? teamValue : opponentValue;
  return typeof selected === "number" ? selected : null;
}

function matchesBefore(matches: RatingMatch[], before?: Date | string | null) {
  if (!before) return matches;
  const boundary = new Date(before).getTime();
  return matches.filter((match) => new Date(match.kickoffAt).getTime() < boundary);
}

function expectedAgainstBucket(input: {
  matches: RatingMatch[];
  bucketByOpponent: Map<string, StrengthBucket | null>;
  bucket: StrengthBucket;
  targetVenue: Exclude<RatingVenue, "ALL">;
  statKey: TrendStatKey;
  scope: RatingScope;
}) {
  const values: number[] = [];

  for (const match of input.matches) {
    const participantId = input.targetVenue === "HOME" ? match.homeTeamId : match.awayTeamId;
    const opponentId = input.targetVenue === "HOME" ? match.awayTeamId : match.homeTeamId;
    if (input.bucketByOpponent.get(opponentId) !== input.bucket) continue;
    const value = valueFor({
      match,
      teamId: participantId,
      statKey: input.statKey,
      scope: input.scope,
    });
    if (value !== null) values.push(value);
  }

  return {
    average: average(values),
    sample: values.length,
  };
}

function buildBucketRows(rows: OpponentStrengthRow[]): OpponentStrengthBucketRow[] {
  return ([1, 2, 3, 4] as StrengthBucket[]).map((bucket) => {
    const bucketRows = rows.filter((row) => row.opponentBucket === bucket);
    const comparable = bucketRows.filter(
      (row): row is OpponentStrengthRow & { expected: number; delta: number } =>
        row.expected !== null && row.delta !== null,
    );

    return {
      bucket,
      label: marketStrengthBucketLabel(bucket),
      matches: bucketRows.length,
      comparableMatches: comparable.length,
      rawAverage: average(bucketRows.map((row) => row.actual)),
      expectedAverage: average(comparable.map((row) => row.expected)),
      deltaAverage: average(comparable.map((row) => row.delta)),
    };
  });
}

export function buildOpponentStrengthProfile(input: {
  teams: RatingTeam[];
  matches: RatingMatch[];
  teamId: string;
  statKey: TrendStatKey;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample?: number;
  before?: Date | string | null;
  currentOpponentId?: string | null;
}): OpponentStrengthProfile {
  const definition = trendDefinition(input.statKey);
  if (!definition) throw new Error("Nieznany rynek analizy siły rywali.");

  const minSample = Math.max(1, Math.floor(input.minSample ?? 3));
  const available = matchesBefore(input.matches, input.before);
  const teamNameById = new Map(input.teams.map((team) => [team.id, team.name]));
  const targetMatches = available
    .filter((match) => {
      const role = roleFor(match, input.teamId);
      return role && (input.venue === "ALL" || role === input.venue);
    })
    .sort((left, right) => new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime())
    .slice(0, input.lookback ?? undefined);

  const rows: OpponentStrengthRow[] = [];

  for (const match of targetMatches) {
    const targetVenue = roleFor(match, input.teamId);
    if (!targetVenue) continue;
    const actual = valueFor({
      match,
      teamId: input.teamId,
      statKey: input.statKey,
      scope: input.scope,
    });
    if (actual === null) continue;

    const opponentId = targetVenue === "HOME" ? match.awayTeamId : match.homeTeamId;
    const opponentVenue = oppositeVenue(targetVenue);
    const priorMatches = matchesBefore(available, match.kickoffAt);
    const opponentRatings = buildMarketRatings({
      teams: input.teams,
      matches: priorMatches,
      statKey: input.statKey,
      scope: opponentRatingScope(input.scope),
      venue: opponentVenue,
      lookback: input.lookback,
      minSample,
      before: match.kickoffAt,
    });
    const bucketByOpponent = new Map(
      opponentRatings.rows.map((row) => [row.teamId, row.strengthBucket] as const),
    );
    const opponent = opponentRatings.rows.find((row) => row.teamId === opponentId) ?? null;
    const baseline = opponent?.strengthBucket
      ? expectedAgainstBucket({
          matches: priorMatches,
          bucketByOpponent,
          bucket: opponent.strengthBucket,
          targetVenue,
          statKey: input.statKey,
          scope: input.scope,
        })
      : { average: null, sample: 0 };

    rows.push({
      matchId: match.id,
      kickoffAt: new Date(match.kickoffAt),
      venue: targetVenue,
      opponentId,
      opponentName: teamNameById.get(opponentId) ?? "Nieznany rywal",
      opponentBucket: opponent?.strengthBucket ?? null,
      opponentRating: opponent?.rating ?? null,
      opponentSample: opponent?.sample ?? 0,
      actual,
      expected: baseline.average,
      delta: baseline.average === null ? null : actual - baseline.average,
      baselineSample: baseline.sample,
    });
  }

  const comparable = rows.filter(
    (row): row is OpponentStrengthRow & { expected: number; delta: number } =>
      row.expected !== null && row.delta !== null,
  );
  const actualValues = rows.map((row) => row.actual);
  const adjustment = average(comparable.map((row) => row.delta));
  const leagueRatings = buildMarketRatings({
    teams: input.teams,
    matches: available,
    statKey: input.statKey,
    scope: input.scope,
    venue: input.venue,
    lookback: input.lookback,
    minSample,
    before: input.before,
  });
  const adjustedAverage =
    adjustment !== null && leagueRatings.leagueAverage !== null
      ? leagueRatings.leagueAverage + adjustment
      : null;

  let currentOpponent: CurrentOpponentStrength | null = null;
  if (input.currentOpponentId && input.venue !== "ALL") {
    const opponentRatings = buildMarketRatings({
      teams: input.teams,
      matches: available,
      statKey: input.statKey,
      scope: opponentRatingScope(input.scope),
      venue: oppositeVenue(input.venue),
      lookback: input.lookback,
      minSample,
      before: input.before,
    });
    const opponent = opponentRatings.rows.find((row) => row.teamId === input.currentOpponentId);
    currentOpponent = {
      teamId: input.currentOpponentId,
      bucket: opponent?.strengthBucket ?? null,
      rating: opponent?.rating ?? null,
      sample: opponent?.sample ?? 0,
      quality: opponent?.quality ?? "NO_DATA",
    };
  }

  return {
    statKey: input.statKey,
    statLabel: definition.label,
    scope: input.scope,
    venue: input.venue,
    lookback: input.lookback,
    minSample,
    sample: rows.length,
    comparableSample: comparable.length,
    rawAverage: average(actualValues),
    median: median(actualValues),
    min: actualValues.length ? Math.min(...actualValues) : null,
    max: actualValues.length ? Math.max(...actualValues) : null,
    expectedAverage: average(comparable.map((row) => row.expected)),
    leagueAverage: leagueRatings.leagueAverage,
    adjustment,
    adjustedAverage,
    quality: quality(comparable.length),
    currentOpponent,
    byBucket: buildBucketRows(rows),
    rows,
  };
}

export function opponentStrengthQualityLabel(value: RatingQuality) {
  if (value === "STRONG") return "mocna korekta";
  if (value === "MODERATE") return "średnia korekta";
  if (value === "WEAK") return "słaba korekta";
  return "brak korekty";
}
