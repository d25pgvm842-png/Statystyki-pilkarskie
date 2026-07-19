import {
  buildMarketProjections,
  type AnalysisMatch,
} from "@/lib/stats/match-analysis";
import {
  trendDefinition,
  type TrendStatKey,
} from "@/lib/stats/trends";

export type BacktestSide = "OVER" | "UNDER" | "BOTH";
export type BacktestLookback = 5 | 10 | 20 | null;
export type BacktestDecisionSide = Exclude<BacktestSide, "BOTH">;
export type BacktestResult = "WIN" | "LOSS" | "PUSH";

export type BacktestTeam = {
  id: string;
  name: string;
};

export type BacktestMatch = AnalysisMatch & {
  round?: number | null;
  homeTeam: BacktestTeam;
  awayTeam: BacktestTeam;
};

export type BacktestSignal = {
  matchId: string;
  kickoffAt: Date;
  round: number | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  projection: number;
  actual: number;
  threshold: number;
  side: BacktestDecisionSide;
  edge: number;
  signedError: number;
  absoluteError: number;
  result: BacktestResult;
  homeSample: number;
  awaySample: number;
  homeFor: number | null;
  awayAgainst: number | null;
  awayFor: number | null;
  homeAgainst: number | null;
};

export type BacktestBreakdown = {
  key: string;
  label: string;
  signals: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number | null;
  averageEdge: number | null;
};

export type BacktestTeamBreakdown = BacktestBreakdown & {
  teamId: string;
  teamName: string;
};

export type BacktestSummary = {
  statKey: TrendStatKey;
  statLabel: string;
  threshold: number;
  requestedSide: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
  matchesTotal: number;
  matchesWithActual: number;
  eligibleMatches: number;
  signals: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number | null;
  coverage: number | null;
  averageEdge: number | null;
  averageProjection: number | null;
  averageActual: number | null;
  meanAbsoluteError: number | null;
  bias: number | null;
  currentStreak: { result: BacktestResult; length: number } | null;
  skippedMissingActual: number;
  skippedMissingProjection: number;
  skippedSample: number;
  skippedNoEdge: number;
  signalsRows: BacktestSignal[];
  edgeBreakdown: BacktestBreakdown[];
  sideBreakdown: BacktestBreakdown[];
  monthlyBreakdown: BacktestBreakdown[];
  teamBreakdown: BacktestTeamBreakdown[];
};

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(numerator: number, denominator: number) {
  return denominator ? (numerator / denominator) * 100 : null;
}

function actualTotal(
  match: BacktestMatch,
  statKey: TrendStatKey,
) {
  const definition = trendDefinition(statKey);
  if (!definition || !match.stats) return null;
  const home = match.stats[definition.home];
  const away = match.stats[definition.away];
  return typeof home === "number" && typeof away === "number"
    ? home + away
    : null;
}

function recentVenueMatches(input: {
  matches: BacktestMatch[];
  teamId: string;
  venue: "HOME" | "AWAY";
  lookback: BacktestLookback;
}) {
  const filtered = input.matches
    .filter((match) =>
      input.venue === "HOME"
        ? match.homeTeamId === input.teamId
        : match.awayTeamId === input.teamId,
    )
    .sort(
      (left, right) =>
        new Date(right.kickoffAt).getTime() - new Date(left.kickoffAt).getTime(),
    );

  return input.lookback === null
    ? filtered
    : filtered.slice(0, input.lookback);
}

function classifyResult(
  actual: number,
  threshold: number,
  side: BacktestDecisionSide,
): BacktestResult {
  if (actual === threshold) return "PUSH";
  if (side === "OVER") return actual > threshold ? "WIN" : "LOSS";
  return actual < threshold ? "WIN" : "LOSS";
}

function decisionSide(input: {
  projection: number;
  threshold: number;
  requestedSide: BacktestSide;
  minEdge: number;
}): BacktestDecisionSide | null {
  const delta = input.projection - input.threshold;

  if (input.requestedSide === "OVER") {
    return delta >= input.minEdge ? "OVER" : null;
  }
  if (input.requestedSide === "UNDER") {
    return -delta >= input.minEdge ? "UNDER" : null;
  }

  if (delta > 0 && delta >= input.minEdge) return "OVER";
  if (delta < 0 && -delta >= input.minEdge) return "UNDER";
  return null;
}

function summarizeBreakdown(
  key: string,
  label: string,
  signals: BacktestSignal[],
): BacktestBreakdown {
  const wins = signals.filter((signal) => signal.result === "WIN").length;
  const losses = signals.filter((signal) => signal.result === "LOSS").length;
  const pushes = signals.filter((signal) => signal.result === "PUSH").length;
  return {
    key,
    label,
    signals: signals.length,
    wins,
    losses,
    pushes,
    hitRate: percentage(wins, wins + losses),
    averageEdge: average(signals.map((signal) => signal.edge)),
  };
}

function edgeBucket(edge: number) {
  if (edge < 0.5) return { key: "0-0.49", label: "0–0,49" };
  if (edge < 1) return { key: "0.5-0.99", label: "0,50–0,99" };
  if (edge < 1.5) return { key: "1-1.49", label: "1,00–1,49" };
  if (edge < 2) return { key: "1.5-1.99", label: "1,50–1,99" };
  return { key: "2+", label: "2,00+" };
}

function currentStreak(signals: BacktestSignal[]) {
  const latest = [...signals].sort(
    (left, right) => right.kickoffAt.getTime() - left.kickoffAt.getTime(),
  );
  const first = latest[0]?.result;
  if (!first) return null;

  let length = 0;
  for (const signal of latest) {
    if (signal.result !== first) break;
    length += 1;
  }
  return { result: first, length };
}

export function runMarketBacktest(input: {
  matches: BacktestMatch[];
  statKey: TrendStatKey;
  threshold: number;
  side: BacktestSide;
  lookback: BacktestLookback;
  minSample: number;
  minEdge: number;
}): BacktestSummary {
  const definition = trendDefinition(input.statKey);
  if (!definition) throw new Error("Nieznany rynek backtestu.");

  const ordered = [...input.matches].sort(
    (left, right) =>
      new Date(left.kickoffAt).getTime() - new Date(right.kickoffAt).getTime(),
  );
  const prior: BacktestMatch[] = [];
  const signalsRows: BacktestSignal[] = [];

  let matchesWithActual = 0;
  let eligibleMatches = 0;
  let skippedMissingActual = 0;
  let skippedMissingProjection = 0;
  let skippedSample = 0;
  let skippedNoEdge = 0;

  for (const match of ordered) {
    const actual = actualTotal(match, input.statKey);
    if (actual === null) {
      skippedMissingActual += 1;
      prior.push(match);
      continue;
    }
    matchesWithActual += 1;

    const homeVenue = recentVenueMatches({
      matches: prior,
      teamId: match.homeTeamId,
      venue: "HOME",
      lookback: input.lookback,
    });
    const awayVenue = recentVenueMatches({
      matches: prior,
      teamId: match.awayTeamId,
      venue: "AWAY",
      lookback: input.lookback,
    });

    const projection = buildMarketProjections({
      homeMatches: homeVenue,
      awayMatches: awayVenue,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
    }).find((item) => item.key === input.statKey);

    if (
      !projection
      || projection.projectedTotal === null
      || projection.homeProjectionQuality !== "FULL"
      || projection.awayProjectionQuality !== "FULL"
    ) {
      skippedMissingProjection += 1;
      prior.push(match);
      continue;
    }

    if (
      projection.homeSample < input.minSample
      || projection.awaySample < input.minSample
    ) {
      skippedSample += 1;
      prior.push(match);
      continue;
    }
    eligibleMatches += 1;

    const side = decisionSide({
      projection: projection.projectedTotal,
      threshold: input.threshold,
      requestedSide: input.side,
      minEdge: input.minEdge,
    });
    if (!side) {
      skippedNoEdge += 1;
      prior.push(match);
      continue;
    }

    const signedError = projection.projectedTotal - actual;
    signalsRows.push({
      matchId: match.id,
      kickoffAt: new Date(match.kickoffAt),
      round: match.round ?? null,
      homeTeamId: match.homeTeamId,
      awayTeamId: match.awayTeamId,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      projection: projection.projectedTotal,
      actual,
      threshold: input.threshold,
      side,
      edge: Math.abs(projection.projectedTotal - input.threshold),
      signedError,
      absoluteError: Math.abs(signedError),
      result: classifyResult(actual, input.threshold, side),
      homeSample: projection.homeSample,
      awaySample: projection.awaySample,
      homeFor: projection.homeFor,
      awayAgainst: projection.awayAgainst,
      awayFor: projection.awayFor,
      homeAgainst: projection.homeAgainst,
    });

    prior.push(match);
  }

  const wins = signalsRows.filter((signal) => signal.result === "WIN").length;
  const losses = signalsRows.filter((signal) => signal.result === "LOSS").length;
  const pushes = signalsRows.filter((signal) => signal.result === "PUSH").length;

  const edgeGroups = new Map<string, { label: string; signals: BacktestSignal[] }>();
  for (const signal of signalsRows) {
    const group = edgeBucket(signal.edge);
    const existing = edgeGroups.get(group.key) ?? { label: group.label, signals: [] };
    existing.signals.push(signal);
    edgeGroups.set(group.key, existing);
  }
  const edgeOrder = ["0-0.49", "0.5-0.99", "1-1.49", "1.5-1.99", "2+"];
  const edgeBreakdown = edgeOrder
    .map((key) => {
      const group = edgeGroups.get(key);
      return group ? summarizeBreakdown(key, group.label, group.signals) : null;
    })
    .filter((row): row is BacktestBreakdown => row !== null);

  const sideBreakdown = (["OVER", "UNDER"] as const)
    .map((side) => summarizeBreakdown(
      side,
      side,
      signalsRows.filter((signal) => signal.side === side),
    ))
    .filter((row) => row.signals > 0);

  const monthlyGroups = new Map<string, BacktestSignal[]>();
  for (const signal of signalsRows) {
    const key = signal.kickoffAt.toISOString().slice(0, 7);
    const rows = monthlyGroups.get(key) ?? [];
    rows.push(signal);
    monthlyGroups.set(key, rows);
  }
  const monthlyBreakdown = [...monthlyGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => summarizeBreakdown(key, key, rows));

  const teamGroups = new Map<string, { name: string; signals: BacktestSignal[] }>();
  for (const signal of signalsRows) {
    for (const [teamId, teamName] of [
      [signal.homeTeamId, signal.homeTeamName],
      [signal.awayTeamId, signal.awayTeamName],
    ] as const) {
      const group = teamGroups.get(teamId) ?? { name: teamName, signals: [] };
      group.signals.push(signal);
      teamGroups.set(teamId, group);
    }
  }
  const teamBreakdown: BacktestTeamBreakdown[] = [...teamGroups.entries()]
    .map(([teamId, group]) => ({
      teamId,
      teamName: group.name,
      ...summarizeBreakdown(teamId, group.name, group.signals),
    }))
    .sort(
      (left, right) =>
        right.signals - left.signals
        || (right.hitRate ?? -1) - (left.hitRate ?? -1)
        || left.teamName.localeCompare(right.teamName, "pl"),
    );

  return {
    statKey: input.statKey,
    statLabel: definition.label,
    threshold: input.threshold,
    requestedSide: input.side,
    lookback: input.lookback,
    minSample: input.minSample,
    minEdge: input.minEdge,
    matchesTotal: ordered.length,
    matchesWithActual,
    eligibleMatches,
    signals: signalsRows.length,
    wins,
    losses,
    pushes,
    hitRate: percentage(wins, wins + losses),
    coverage: percentage(signalsRows.length, eligibleMatches),
    averageEdge: average(signalsRows.map((signal) => signal.edge)),
    averageProjection: average(signalsRows.map((signal) => signal.projection)),
    averageActual: average(signalsRows.map((signal) => signal.actual)),
    meanAbsoluteError: average(signalsRows.map((signal) => signal.absoluteError)),
    bias: average(signalsRows.map((signal) => signal.signedError)),
    currentStreak: currentStreak(signalsRows),
    skippedMissingActual,
    skippedMissingProjection,
    skippedSample,
    skippedNoEdge,
    signalsRows: [...signalsRows].sort(
      (left, right) => right.kickoffAt.getTime() - left.kickoffAt.getTime(),
    ),
    edgeBreakdown,
    sideBreakdown,
    monthlyBreakdown,
    teamBreakdown,
  };
}
