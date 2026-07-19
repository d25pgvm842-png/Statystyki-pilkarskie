export const TREND_STAT_DEFINITIONS = [
  {
    key: "corners",
    label: "Rzuty rożne",
    shortLabel: "Rożne",
    home: "homeCorners",
    away: "awayCorners",
    totalLines: [8.5, 9.5, 10.5, 11.5],
    teamLines: [3.5, 4.5, 5.5, 6.5],
  },
  {
    key: "yellowCards",
    label: "Żółte kartki",
    shortLabel: "Żółte",
    home: "homeYellowCards",
    away: "awayYellowCards",
    totalLines: [3.5, 4.5, 5.5, 6.5],
    teamLines: [1.5, 2.5, 3.5, 4.5],
  },
  {
    key: "redCards",
    label: "Czerwone kartki",
    shortLabel: "Czerwone",
    home: "homeRedCards",
    away: "awayRedCards",
    totalLines: [0.5, 1.5, 2.5],
    teamLines: [0.5, 1.5],
  },
  {
    key: "shotsOnTarget",
    label: "Celne strzały",
    shortLabel: "Celne",
    home: "homeShotsOnTarget",
    away: "awayShotsOnTarget",
    totalLines: [7.5, 8.5, 9.5, 10.5],
    teamLines: [2.5, 3.5, 4.5, 5.5],
  },
  {
    key: "shots",
    label: "Wszystkie strzały",
    shortLabel: "Strzały",
    home: "homeShots",
    away: "awayShots",
    totalLines: [20.5, 22.5, 24.5, 26.5],
    teamLines: [8.5, 10.5, 12.5, 14.5],
  },
  {
    key: "fouls",
    label: "Faule",
    shortLabel: "Faule",
    home: "homeFouls",
    away: "awayFouls",
    totalLines: [20.5, 22.5, 24.5, 26.5],
    teamLines: [9.5, 11.5, 13.5, 15.5],
  },
  {
    key: "offsides",
    label: "Spalone",
    shortLabel: "Spalone",
    home: "homeOffsides",
    away: "awayOffsides",
    totalLines: [2.5, 3.5, 4.5, 5.5],
    teamLines: [0.5, 1.5, 2.5, 3.5],
  },
] as const;

export type TrendStatKey = (typeof TREND_STAT_DEFINITIONS)[number]["key"];
export type TrendScope = "MATCH_TOTAL" | "TEAM_FOR" | "TEAM_AGAINST";
export type TrendVenue = "ALL" | "HOME" | "AWAY";

type StatField =
  | (typeof TREND_STAT_DEFINITIONS)[number]["home"]
  | (typeof TREND_STAT_DEFINITIONS)[number]["away"];

type StatsRecord = Partial<Record<StatField, number | null>>;

export type TrendMatch = {
  kickoffAt: Date | string;
  homeTeamId: string;
  awayTeamId: string;
  stats: StatsRecord | null;
};

export type TrendValue = {
  value: number;
  kickoffAt: Date;
  venue: Exclude<TrendVenue, "ALL"> | null;
};

export type TrendLineSummary = {
  threshold: number;
  count: number;
  overCount: number;
  underCount: number;
  pushCount: number;
  overRate: number | null;
  underRate: number | null;
  pushRate: number | null;
  average: number | null;
  median: number | null;
  min: number | null;
  max: number | null;
  streak: { result: "OVER" | "UNDER" | "PUSH"; length: number } | null;
  recent: Array<TrendValue & { result: "OVER" | "UNDER" | "PUSH" }>;
};

export function trendDefinition(statKey: string) {
  return TREND_STAT_DEFINITIONS.find((definition) => definition.key === statKey) ?? null;
}

export function presetLines(statKey: TrendStatKey, scope: TrendScope) {
  const definition = trendDefinition(statKey);
  if (!definition) return [];
  return scope === "MATCH_TOTAL" ? [...definition.totalLines] : [...definition.teamLines];
}

function roleFor(match: TrendMatch, teamId: string) {
  if (match.homeTeamId === teamId) return "HOME" as const;
  if (match.awayTeamId === teamId) return "AWAY" as const;
  return null;
}

export function extractTrendValues(
  matches: TrendMatch[],
  options: {
    statKey: TrendStatKey;
    scope: TrendScope;
    teamId?: string | null;
    venue?: TrendVenue;
    limit?: number | null;
  },
) {
  const definition = trendDefinition(options.statKey);
  if (!definition) return [];

  const venue = options.venue ?? "ALL";
  const values: TrendValue[] = [];

  const ordered = [...matches].sort(
    (left, right) => new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
  );

  for (const match of ordered) {
    if (!match.stats) continue;

    const role = options.teamId ? roleFor(match, options.teamId) : null;
    if (options.teamId && !role) continue;
    if (venue !== "ALL" && role !== venue) continue;

    const homeValue = match.stats[definition.home];
    const awayValue = match.stats[definition.away];
    let value: number | null = null;

    if (options.scope === "MATCH_TOTAL") {
      if (typeof homeValue === "number" && typeof awayValue === "number") {
        value = homeValue + awayValue;
      }
    } else {
      if (!options.teamId || !role) continue;
      const teamValue = role === "HOME" ? homeValue : awayValue;
      const opponentValue = role === "HOME" ? awayValue : homeValue;
      const selected = options.scope === "TEAM_FOR" ? teamValue : opponentValue;
      if (typeof selected === "number") value = selected;
    }

    if (value === null) continue;
    values.push({ value, kickoffAt: new Date(match.kickoffAt), venue: role });
    if (options.limit && values.length >= options.limit) break;
  }

  return values;
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function classify(value: number, threshold: number) {
  if (value > threshold) return "OVER" as const;
  if (value < threshold) return "UNDER" as const;
  return "PUSH" as const;
}

function percentage(count: number, total: number) {
  return total ? (count / total) * 100 : null;
}

export function analyzeTrendLine(values: TrendValue[], threshold: number): TrendLineSummary {
  const classified = values.map((item) => ({ ...item, result: classify(item.value, threshold) }));
  const overCount = classified.filter((item) => item.result === "OVER").length;
  const underCount = classified.filter((item) => item.result === "UNDER").length;
  const pushCount = classified.filter((item) => item.result === "PUSH").length;
  const numericValues = classified.map((item) => item.value);
  const sum = numericValues.reduce((total, value) => total + value, 0);

  const firstResult = classified[0]?.result;
  let streakLength = 0;
  if (firstResult) {
    for (const item of classified) {
      if (item.result !== firstResult) break;
      streakLength += 1;
    }
  }

  return {
    threshold,
    count: classified.length,
    overCount,
    underCount,
    pushCount,
    overRate: percentage(overCount, classified.length),
    underRate: percentage(underCount, classified.length),
    pushRate: percentage(pushCount, classified.length),
    average: classified.length ? sum / classified.length : null,
    median: median(numericValues),
    min: classified.length ? Math.min(...numericValues) : null,
    max: classified.length ? Math.max(...numericValues) : null,
    streak: firstResult ? { result: firstResult, length: streakLength } : null,
    recent: classified.slice(0, 10),
  };
}
