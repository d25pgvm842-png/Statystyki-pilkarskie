import {
  TREND_STAT_DEFINITIONS,
  extractTrendValues,
  trendDefinition,
  type TrendMatch,
  type TrendScope,
  type TrendStatKey,
  type TrendVenue,
} from "@/lib/stats/trends";

export type RatingScope = TrendScope;
export type RatingVenue = TrendVenue;
export type RatingLookback = 5 | 10 | 20 | null;
export type RatingBucket = "LOW" | "BELOW_AVERAGE" | "ABOVE_AVERAGE" | "HIGH";
export type StrengthBucket = 1 | 2 | 3 | 4;
export type RatingQuality = "NO_DATA" | "WEAK" | "MODERATE" | "STRONG";

export type RatingTeam = {
  id: string;
  name: string;
  shortName?: string | null;
};

export type RatingMatch = TrendMatch & {
  id: string;
};

export type StrengthBucketSummary = {
  bucket: StrengthBucket;
  label: string;
  percentileFrom: number;
  percentileTo: number;
  teams: number;
  minAverage: number | null;
  maxAverage: number | null;
};

export type MarketRatingRow = {
  position: number | null;
  teamId: string;
  teamName: string;
  teamShortName: string | null;
  sample: number;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  leagueAverage: number | null;
  delta: number | null;
  deltaPercent: number | null;
  percentile: number | null;
  rating: number | null;
  bucket: RatingBucket | null;
  strengthBucket: StrengthBucket | null;
  quality: RatingQuality;
  eligible: boolean;
};

export type MarketRatingsResult = {
  statKey: TrendStatKey;
  statLabel: string;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample: number;
  leagueAverage: number | null;
  teamsTotal: number;
  teamsWithData: number;
  eligibleTeams: number;
  bucketRule: string;
  bucketSummaries: StrengthBucketSummary[];
  rows: MarketRatingRow[];
};

export type TeamMarketProfileRow = {
  statKey: TrendStatKey;
  label: string;
  for: MarketRatingRow | null;
  against: MarketRatingRow | null;
  total: MarketRatingRow | null;
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

function strengthBucket(percentile: number): StrengthBucket {
  if (percentile >= 75) return 1;
  if (percentile >= 50) return 2;
  if (percentile >= 25) return 3;
  return 4;
}

function bucketFromStrength(value: StrengthBucket): RatingBucket {
  if (value === 1) return "HIGH";
  if (value === 2) return "ABOVE_AVERAGE";
  if (value === 3) return "BELOW_AVERAGE";
  return "LOW";
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 1e-9;
}

function matchesBefore(matches: RatingMatch[], before?: Date | string | null) {
  if (!before) return matches;
  const boundary = new Date(before).getTime();
  return matches.filter((match) => new Date(match.kickoffAt).getTime() < boundary);
}

function ratingValues(input: {
  matches: RatingMatch[];
  teamId: string;
  statKey: TrendStatKey;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  before?: Date | string | null;
}) {
  const available = matchesBefore(input.matches, input.before);
  return extractTrendValues(available, {
    statKey: input.statKey,
    scope: input.scope,
    teamId: input.teamId,
    venue: input.venue,
    limit: input.lookback,
  }).map((item) => item.value);
}

function buildBucketSummaries(rows: MarketRatingRow[]): StrengthBucketSummary[] {
  const definitions: Array<{
    bucket: StrengthBucket;
    percentileFrom: number;
    percentileTo: number;
  }> = [
    { bucket: 1, percentileFrom: 75, percentileTo: 100 },
    { bucket: 2, percentileFrom: 50, percentileTo: 75 },
    { bucket: 3, percentileFrom: 25, percentileTo: 50 },
    { bucket: 4, percentileFrom: 0, percentileTo: 25 },
  ];

  return definitions.map((definition) => {
    const bucketRows = rows.filter(
      (row): row is MarketRatingRow & { average: number } =>
        row.strengthBucket === definition.bucket && row.average !== null,
    );
    const averages = bucketRows.map((row) => row.average);

    return {
      ...definition,
      label: marketStrengthBucketLabel(definition.bucket),
      teams: bucketRows.length,
      minAverage: averages.length ? Math.min(...averages) : null,
      maxAverage: averages.length ? Math.max(...averages) : null,
    };
  });
}

export function buildMarketRatings(input: {
  teams: RatingTeam[];
  matches: RatingMatch[];
  statKey: TrendStatKey;
  scope: RatingScope;
  venue: RatingVenue;
  lookback: RatingLookback;
  minSample?: number;
  before?: Date | string | null;
}): MarketRatingsResult {
  const definition = trendDefinition(input.statKey);
  if (!definition) throw new Error("Nieznany rynek ratingowy.");

  const minSample = Math.max(1, Math.floor(input.minSample ?? 3));
  const baseRows = input.teams.map((team) => {
    const values = ratingValues({
      matches: input.matches,
      teamId: team.id,
      statKey: input.statKey,
      scope: input.scope,
      venue: input.venue,
      lookback: input.lookback,
      before: input.before,
    });
    const rowAverage = average(values);
    return {
      teamId: team.id,
      teamName: team.name,
      teamShortName: team.shortName ?? null,
      sample: values.length,
      average: rowAverage,
      median: median(values),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      quality: quality(values.length),
      eligible: rowAverage !== null && values.length >= minSample,
    };
  });

  const eligible = baseRows
    .filter((row): row is typeof row & { average: number } => row.eligible && row.average !== null)
    .sort((left, right) => left.average - right.average || left.teamName.localeCompare(right.teamName, "pl"));

  const leagueAverage = average(eligible.map((row) => row.average));
  const percentileByTeam = new Map<string, number>();

  if (eligible.length === 1) {
    percentileByTeam.set(eligible[0].teamId, 50);
  } else if (eligible.length > 1) {
    let start = 0;
    while (start < eligible.length) {
      let end = start;
      while (
        end + 1 < eligible.length
        && sameNumber(eligible[end + 1].average, eligible[start].average)
      ) {
        end += 1;
      }
      const midRank = (start + end) / 2;
      const percentile = (midRank / (eligible.length - 1)) * 100;
      for (let index = start; index <= end; index += 1) {
        percentileByTeam.set(eligible[index].teamId, percentile);
      }
      start = end + 1;
    }
  }

  const descending = [...eligible].sort(
    (left, right) => right.average - left.average || left.teamName.localeCompare(right.teamName, "pl"),
  );
  const positionByTeam = new Map<string, number>();
  let previousAverage: number | null = null;
  let previousPosition = 0;
  descending.forEach((row, index) => {
    const position = previousAverage !== null && sameNumber(row.average, previousAverage)
      ? previousPosition
      : index + 1;
    positionByTeam.set(row.teamId, position);
    previousAverage = row.average;
    previousPosition = position;
  });

  const rows: MarketRatingRow[] = baseRows
    .map((row) => {
      const percentile = percentileByTeam.get(row.teamId) ?? null;
      const strength = percentile === null ? null : strengthBucket(percentile);
      const delta =
        row.average !== null && leagueAverage !== null
          ? row.average - leagueAverage
          : null;
      const deltaPercent =
        delta !== null && leagueAverage !== null && leagueAverage !== 0
          ? (delta / leagueAverage) * 100
          : null;

      return {
        ...row,
        position: positionByTeam.get(row.teamId) ?? null,
        leagueAverage,
        delta,
        deltaPercent,
        percentile,
        rating: percentile === null ? null : Math.round(percentile),
        bucket: strength === null ? null : bucketFromStrength(strength),
        strengthBucket: strength,
      };
    })
    .sort((left, right) => {
      if (left.position !== null && right.position !== null) {
        return left.position - right.position || left.teamName.localeCompare(right.teamName, "pl");
      }
      if (left.position !== null) return -1;
      if (right.position !== null) return 1;
      return right.sample - left.sample || left.teamName.localeCompare(right.teamName, "pl");
    });

  return {
    statKey: input.statKey,
    statLabel: definition.label,
    scope: input.scope,
    venue: input.venue,
    lookback: input.lookback,
    minSample,
    leagueAverage,
    teamsTotal: input.teams.length,
    teamsWithData: baseRows.filter((row) => row.sample > 0).length,
    eligibleTeams: eligible.length,
    bucketRule: marketStrengthBucketRule(),
    bucketSummaries: buildBucketSummaries(rows),
    rows,
  };
}

export function buildTeamMarketProfile(input: {
  teams: RatingTeam[];
  matches: RatingMatch[];
  teamId: string;
  lookback: RatingLookback;
  venue?: RatingVenue;
  minSample?: number;
  before?: Date | string | null;
}): TeamMarketProfileRow[] {
  const venue = input.venue ?? "ALL";
  const minSample = input.minSample ?? 3;

  return TREND_STAT_DEFINITIONS.map((definition) => {
    const forRatings = buildMarketRatings({
      ...input,
      statKey: definition.key,
      scope: "TEAM_FOR",
      venue,
      minSample,
    });
    const againstRatings = buildMarketRatings({
      ...input,
      statKey: definition.key,
      scope: "TEAM_AGAINST",
      venue,
      minSample,
    });
    const totalRatings = buildMarketRatings({
      ...input,
      statKey: definition.key,
      scope: "MATCH_TOTAL",
      venue,
      minSample,
    });

    return {
      statKey: definition.key,
      label: definition.label,
      for: forRatings.rows.find((row) => row.teamId === input.teamId) ?? null,
      against: againstRatings.rows.find((row) => row.teamId === input.teamId) ?? null,
      total: totalRatings.rows.find((row) => row.teamId === input.teamId) ?? null,
    };
  });
}

export function marketRatingBucketLabel(value: RatingBucket | null) {
  if (value === "LOW") return "niski";
  if (value === "BELOW_AVERAGE") return "poniżej średniej";
  if (value === "ABOVE_AVERAGE") return "powyżej średniej";
  if (value === "HIGH") return "wysoki";
  return "brak ratingu";
}

export function marketStrengthBucketLabel(value: StrengthBucket | null) {
  if (value === 1) return "Koszyk 1 · najwyższa wartość";
  if (value === 2) return "Koszyk 2 · powyżej mediany";
  if (value === 3) return "Koszyk 3 · poniżej mediany";
  if (value === 4) return "Koszyk 4 · najniższa wartość";
  return "Brak koszyka";
}

export function marketStrengthBucketRule() {
  return "K1: P75–P100, K2: P50–<P75, K3: P25–<P50, K4: P0–<P25. Remisy zachowują ten sam percentyl i koszyk, dlatego liczebność koszyków może być nierówna.";
}

export function marketRatingQualityLabel(value: RatingQuality) {
  if (value === "STRONG") return "mocna próba";
  if (value === "MODERATE") return "średnia próba";
  if (value === "WEAK") return "słaba próba";
  return "brak danych";
}
