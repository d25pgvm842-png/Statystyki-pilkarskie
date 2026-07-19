import {
  TREND_STAT_DEFINITIONS,
  analyzeTrendLine,
  extractTrendValues,
  presetLines,
  type TrendLineSummary,
  type TrendScope,
  type TrendStatKey,
} from "@/lib/stats/trends";

export type AnalysisStatField =
  | (typeof TREND_STAT_DEFINITIONS)[number]["home"]
  | (typeof TREND_STAT_DEFINITIONS)[number]["away"];

export type AnalysisStats = Partial<Record<AnalysisStatField, number | null>>;

export type ProjectionQuality =
  | "FULL"
  | "ONE_SIDED_FOR"
  | "ONE_SIDED_AGAINST"
  | "MISSING";

export type AnalysisMatch = {
  id: string;
  kickoffAt: Date | string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  stats: AnalysisStats | null;
};

export type FormSummary = {
  count: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  pointsPerMatch: number | null;
  goalsFor: number;
  goalsAgainst: number;
};

export type MarketProjection = {
  key: TrendStatKey;
  label: string;
  shortLabel: string;
  homeFor: number | null;
  homeAgainst: number | null;
  awayFor: number | null;
  awayAgainst: number | null;
  projectedHome: number | null;
  projectedAway: number | null;
  projectedTotal: number | null;
  homeProjectionQuality: ProjectionQuality;
  awayProjectionQuality: ProjectionQuality;
  homeForSample: number;
  homeAgainstSample: number;
  awayForSample: number;
  awayAgainstSample: number;
  homeSample: number;
  awaySample: number;
  totalSample: number;
  lines: TrendLineSummary[];
};

export type RefereeSummary = {
  count: number;
  yellowCards: number | null;
  yellowCardsSample: number;
  redCards: number | null;
  redCardsSample: number;
  cards: number | null;
  cardsSample: number;
  fouls: number | null;
  foulsSample: number;
  corners: number | null;
  cornersSample: number;
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function projection(
  forValue: number | null,
  againstValue: number | null,
): { value: number | null; quality: ProjectionQuality } {
  if (forValue !== null && againstValue !== null) {
    return { value: (forValue + againstValue) / 2, quality: "FULL" };
  }
  if (forValue !== null) {
    return { value: forValue, quality: "ONE_SIDED_FOR" };
  }
  if (againstValue !== null) {
    return { value: againstValue, quality: "ONE_SIDED_AGAINST" };
  }
  return { value: null, quality: "MISSING" };
}

function teamRole(match: AnalysisMatch, teamId: string) {
  if (match.homeTeamId === teamId) return "HOME" as const;
  if (match.awayTeamId === teamId) return "AWAY" as const;
  return null;
}

function teamValues(
  matches: AnalysisMatch[],
  teamId: string,
  definition: (typeof TREND_STAT_DEFINITIONS)[number],
) {
  const team: number[] = [];
  const opponent: number[] = [];

  for (const match of matches) {
    if (!match.stats) continue;
    const role = teamRole(match, teamId);
    if (!role) continue;
    const teamField = role === "HOME" ? definition.home : definition.away;
    const opponentField = role === "HOME" ? definition.away : definition.home;
    const teamValue = match.stats[teamField];
    const opponentValue = match.stats[opponentField];
    if (typeof teamValue === "number") team.push(teamValue);
    if (typeof opponentValue === "number") opponent.push(opponentValue);
  }

  return { team, opponent };
}

function uniqueMatches(matches: AnalysisMatch[]) {
  return [...new Map(matches.map((match) => [match.id, match])).values()];
}

export function summarizeForm(matches: AnalysisMatch[], teamId: string): FormSummary {
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let count = 0;

  for (const match of matches) {
    if (match.homeScore === null || match.awayScore === null) continue;
    const role = teamRole(match, teamId);
    if (!role) continue;
    const scored = role === "HOME" ? match.homeScore : match.awayScore;
    const conceded = role === "HOME" ? match.awayScore : match.homeScore;
    count += 1;
    goalsFor += scored;
    goalsAgainst += conceded;
    if (scored > conceded) wins += 1;
    else if (scored === conceded) draws += 1;
    else losses += 1;
  }

  const points = wins * 3 + draws;
  return {
    count,
    wins,
    draws,
    losses,
    points,
    pointsPerMatch: count ? points / count : null,
    goalsFor,
    goalsAgainst,
  };
}

export function buildMarketProjections(input: {
  homeMatches: AnalysisMatch[];
  awayMatches: AnalysisMatch[];
  homeTeamId: string;
  awayTeamId: string;
}): MarketProjection[] {
  const combined = uniqueMatches([...input.homeMatches, ...input.awayMatches]);

  return TREND_STAT_DEFINITIONS.map((definition) => {
    const home = teamValues(input.homeMatches, input.homeTeamId, definition);
    const away = teamValues(input.awayMatches, input.awayTeamId, definition);
    const homeFor = average(home.team);
    const homeAgainst = average(home.opponent);
    const awayFor = average(away.team);
    const awayAgainst = average(away.opponent);
    const homeProjection = projection(homeFor, awayAgainst);
    const awayProjection = projection(awayFor, homeAgainst);
    const projectedTotal =
      homeProjection.quality === "FULL"
      && awayProjection.quality === "FULL"
      && homeProjection.value !== null
      && awayProjection.value !== null
        ? homeProjection.value + awayProjection.value
        : null;
    const totalValues = extractTrendValues(combined, {
      statKey: definition.key,
      scope: "MATCH_TOTAL",
      venue: "ALL",
      limit: null,
    });

    return {
      key: definition.key,
      label: definition.label,
      shortLabel: definition.shortLabel,
      homeFor,
      homeAgainst,
      awayFor,
      awayAgainst,
      projectedHome: homeProjection.value,
      projectedAway: awayProjection.value,
      projectedTotal,
      homeProjectionQuality: homeProjection.quality,
      awayProjectionQuality: awayProjection.quality,
      homeForSample: home.team.length,
      homeAgainstSample: home.opponent.length,
      awayForSample: away.team.length,
      awayAgainstSample: away.opponent.length,
      homeSample: Math.min(home.team.length, away.opponent.length),
      awaySample: Math.min(away.team.length, home.opponent.length),
      totalSample: totalValues.length,
      lines: presetLines(definition.key, "MATCH_TOTAL").map((line) =>
        analyzeTrendLine(totalValues, line),
      ),
    };
  });
}

export function summarizeReferee(matches: AnalysisMatch[]): RefereeSummary {
  const yellow: number[] = [];
  const red: number[] = [];
  const cards: number[] = [];
  const fouls: number[] = [];
  const corners: number[] = [];

  for (const match of matches) {
    const stats = match.stats;
    if (!stats) continue;

    const hasYellow =
      typeof stats.homeYellowCards === "number"
      && typeof stats.awayYellowCards === "number";
    const hasRed =
      typeof stats.homeRedCards === "number"
      && typeof stats.awayRedCards === "number";

    if (hasYellow) {
      yellow.push(stats.homeYellowCards! + stats.awayYellowCards!);
    }
    if (hasRed) {
      red.push(stats.homeRedCards! + stats.awayRedCards!);
    }
    if (hasYellow && hasRed) {
      cards.push(
        stats.homeYellowCards!
        + stats.awayYellowCards!
        + stats.homeRedCards!
        + stats.awayRedCards!,
      );
    }
    if (typeof stats.homeFouls === "number" && typeof stats.awayFouls === "number") {
      fouls.push(stats.homeFouls + stats.awayFouls);
    }
    if (
      typeof stats.homeCorners === "number"
      && typeof stats.awayCorners === "number"
    ) {
      corners.push(stats.homeCorners + stats.awayCorners);
    }
  }

  return {
    count: matches.length,
    yellowCards: average(yellow),
    yellowCardsSample: yellow.length,
    redCards: average(red),
    redCardsSample: red.length,
    cards: average(cards),
    cardsSample: cards.length,
    fouls: average(fouls),
    foulsSample: fouls.length,
    corners: average(corners),
    cornersSample: corners.length,
  };
}

export function analyzeCustomLineForMatch(input: {
  statKey: TrendStatKey;
  scope: TrendScope;
  threshold: number;
  homeMatches: AnalysisMatch[];
  awayMatches: AnalysisMatch[];
  homeTeamId: string;
  awayTeamId: string;
}) {
  if (input.scope === "MATCH_TOTAL") {
    const values = extractTrendValues(
      uniqueMatches([...input.homeMatches, ...input.awayMatches]),
      {
        statKey: input.statKey,
        scope: input.scope,
        venue: "ALL",
        limit: null,
      },
    );
    return {
      combined: analyzeTrendLine(values, input.threshold),
      home: null,
      away: null,
    };
  }

  const homeValues = extractTrendValues(input.homeMatches, {
    statKey: input.statKey,
    scope: input.scope,
    teamId: input.homeTeamId,
    venue: "HOME",
    limit: null,
  });
  const awayValues = extractTrendValues(input.awayMatches, {
    statKey: input.statKey,
    scope: input.scope,
    teamId: input.awayTeamId,
    venue: "AWAY",
    limit: null,
  });

  return {
    combined: null,
    home: analyzeTrendLine(homeValues, input.threshold),
    away: analyzeTrendLine(awayValues, input.threshold),
  };
}
