export const MATCH_TOTAL_STAT_DEFINITIONS = [
  { key: "corners", label: "Rzuty rożne", home: "homeCorners", away: "awayCorners" },
  { key: "yellowCards", label: "Żółte kartki", home: "homeYellowCards", away: "awayYellowCards" },
  { key: "redCards", label: "Czerwone kartki", home: "homeRedCards", away: "awayRedCards" },
  { key: "shotsOnTarget", label: "Celne strzały", home: "homeShotsOnTarget", away: "awayShotsOnTarget" },
  { key: "shots", label: "Wszystkie strzały", home: "homeShots", away: "awayShots" },
  { key: "fouls", label: "Faule", home: "homeFouls", away: "awayFouls" },
  { key: "offsides", label: "Spalone", home: "homeOffsides", away: "awayOffsides" },
] as const;

type StatField =
  | (typeof MATCH_TOTAL_STAT_DEFINITIONS)[number]["home"]
  | (typeof MATCH_TOTAL_STAT_DEFINITIONS)[number]["away"];

type StatsRecord = Partial<Record<StatField, number | null>>;

type MatchObservation = {
  stats: StatsRecord | null;
};

export type TotalMetricSummary = {
  key: (typeof MATCH_TOTAL_STAT_DEFINITIONS)[number]["key"];
  label: string;
  count: number;
  sum: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

function totalFor(stats: StatsRecord | null, home: StatField, away: StatField) {
  if (!stats) return null;
  const homeValue = stats[home];
  const awayValue = stats[away];
  return typeof homeValue === "number" && typeof awayValue === "number"
    ? homeValue + awayValue
    : null;
}

function summarize(values: number[]) {
  if (!values.length) {
    return { count: 0, sum: 0, average: null, min: null, max: null };
  }

  const sum = values.reduce((current, value) => current + value, 0);
  return {
    count: values.length,
    sum,
    average: sum / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function calculateMatchSummary(matches: MatchObservation[]) {
  const metrics: TotalMetricSummary[] = MATCH_TOTAL_STAT_DEFINITIONS.map((definition) => {
    const values = matches
      .map((match) => totalFor(match.stats, definition.home, definition.away))
      .filter((value): value is number => typeof value === "number");

    return {
      key: definition.key,
      label: definition.label,
      ...summarize(values),
    };
  });

  const matchesWithStats = matches.filter((match) =>
    MATCH_TOTAL_STAT_DEFINITIONS.some(
      (definition) => totalFor(match.stats, definition.home, definition.away) !== null,
    ),
  ).length;

  return {
    matches: matches.length,
    matchesWithStats,
    completeness: matches.length ? (matchesWithStats / matches.length) * 100 : 0,
    metrics,
  };
}

function hitRate(values: number[], threshold: number) {
  if (!values.length) return null;
  return (values.filter((value) => value > threshold).length / values.length) * 100;
}

export function calculateRefereeSummary(matches: MatchObservation[]) {
  const summary = calculateMatchSummary(matches);
  const yellowDefinition = MATCH_TOTAL_STAT_DEFINITIONS.find((item) => item.key === "yellowCards")!;
  const yellowTotals = matches
    .map((match) => totalFor(match.stats, yellowDefinition.home, yellowDefinition.away))
    .filter((value): value is number => typeof value === "number");

  return {
    ...summary,
    yellowCardLines: [3.5, 4.5, 5.5].map((threshold) => ({
      threshold,
      count: yellowTotals.length,
      hitRate: hitRate(yellowTotals, threshold),
    })),
  };
}
