import {
  selectionClv,
  type JournalResult,
  type JournalSide,
} from "@/lib/stats/analysis-journal";
import { summarizeBettingFinancials } from "@/lib/stats/betting-metrics";
import {
  isHistoricalDecisionEligible,
  type AnalysisDecisionTiming,
} from "@/lib/stats/decision-integrity";

export type StrategyTarget = "MATCH_TOTAL" | "HOME_TEAM" | "AWAY_TEAM" | "UNKNOWN";
export type StrategyDecisionMode = "ALL" | "PLAYED" | "SETTLED" | "WATCHING";
export type StrategyConfidence = "NO_DATA" | "WEAK" | "LIMITED" | "MEDIUM" | "STRONG";
export type StrategyStability = "INSUFFICIENT" | "STABLE" | "WATCH" | "UNSTABLE";

export type StrategyConfig = {
  id?: string;
  name: string;
  description?: string | null;
  active?: boolean;
  leagueId?: string | null;
  seasonId?: string | null;
  statKey?: string | null;
  scope?: string | null;
  target?: Exclude<StrategyTarget, "UNKNOWN"> | null;
  side?: JournalSide | null;
  source?: string | null;
  modelVersion?: string | null;
  marketStatus?: string | null;
  evidenceStatus?: string | null;
  bookmaker?: string | null;
  decisionMode: StrategyDecisionMode;
  minModelProbability?: number | null;
  maxModelProbability?: number | null;
  minExpectedValue?: number | null;
  maxExpectedValue?: number | null;
  minOdds?: number | null;
  maxOdds?: number | null;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  minEdge?: number | null;
  minModelSample?: number | null;
  minCoverage?: number | null;
  minBacktestSignals?: number | null;
  minBacktestHitRate?: number | null;
  minimumConfidence?: StrategyConfidence | null;
};

export type StrategyEntry = {
  id: string;
  matchId: string;
  kickoffAt: Date;
  createdAt: Date;
  quoteCapturedAt: Date | null;
  decisionAt: Date;
  decisionTiming: AnalysisDecisionTiming;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  statKey: string;
  statLabel: string;
  threshold: number;
  scope: string;
  target: StrategyTarget;
  side: JournalSide;
  source: string;
  status: string;
  result: JournalResult | null;
  odds: number | null;
  closingOdds: number | null;
  stake: number | null;
  projection: number | null;
  edge: number | null;
  evidenceStatus: string | null;
  backtestSignals: number | null;
  backtestHitRate: number | null;
  modelProbability: number | null;
  expectedValue: number | null;
  modelSample: number | null;
  modelCoverage: number | null;
  modelConfidence: string | null;
  modelVersion: string | null;
  marketStatus: string | null;
  bookmaker: string | null;
};

export type StrategyMetrics = {
  totalEntries: number;
  openEntries: number;
  settledEntries: number;
  resolvedEntries: number;
  wins: number;
  losses: number;
  pushes: number;
  voided: number;
  hitRate: number | null;
  calibrationEntries: number;
  calibrationHitRate: number | null;
  averageModelProbability: number | null;
  calibrationGap: number | null;
  brierScore: number | null;
  averageExpectedValue: number | null;
  averageOdds: number | null;
  averageClv: number | null;
  financialEntries: number;
  turnover: number;
  profit: number;
  roi: number | null;
  maxDrawdown: number | null;
  longestWinStreak: number;
  longestLossStreak: number;
  smallSample: boolean;
};

export type StrategySegmentRow = StrategyMetrics & {
  key: string;
  label: string;
};

export type StrategyMonthRow = StrategyMetrics & {
  key: string;
  label: string;
};

export type StrategyEvaluation = {
  config: StrategyConfig;
  matchedEntries: StrategyEntry[];
  currentEntries: StrategyEntry[];
  metrics: StrategyMetrics;
  training: StrategyMetrics;
  validation: StrategyMetrics;
  stability: StrategyStability;
  trainingEntries: number;
  validationEntries: number;
  excludedTimingEntries: number;
  byMonth: StrategyMonthRow[];
  byLeague: StrategySegmentRow[];
  byMarket: StrategySegmentRow[];
  bySide: StrategySegmentRow[];
  byModelVersion: StrategySegmentRow[];
};

export type StrategyHistoricalSnapshot = {
  capturedAt: string;
  matchedEntries: number;
  trainingEntries: number;
  validationEntries: number;
  excludedTimingEntries?: number;
  stability: StrategyStability;
  metrics: StrategyMetrics;
  training: StrategyMetrics;
  validation: StrategyMetrics;
};

export function snapshotStrategyEvaluation(
  evaluation: StrategyEvaluation,
  capturedAt: Date,
): StrategyHistoricalSnapshot {
  return {
    capturedAt: capturedAt.toISOString(),
    matchedEntries: evaluation.matchedEntries.length,
    trainingEntries: evaluation.trainingEntries,
    validationEntries: evaluation.validationEntries,
    excludedTimingEntries: evaluation.excludedTimingEntries,
    stability: evaluation.stability,
    metrics: evaluation.metrics,
    training: evaluation.training,
    validation: evaluation.validation,
  };
}

const confidenceOrder: StrategyConfidence[] = [
  "NO_DATA",
  "WEAK",
  "LIMITED",
  "MEDIUM",
  "STRONG",
];

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validProbability(value: number | null | undefined) {
  const parsed = finite(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
}

function validOdds(value: number | null | undefined) {
  const parsed = finite(value);
  return parsed !== null && parsed > 1 ? parsed : null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function normalizedText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase("pl") ?? "";
}

function confidenceRank(value: string | null | undefined) {
  const index = confidenceOrder.indexOf((value ?? "NO_DATA") as StrategyConfidence);
  return index >= 0 ? index : 0;
}

function meetsMinimum(value: number | null | undefined, minimum: number | null | undefined) {
  if (minimum === null || minimum === undefined) return true;
  const parsed = finite(value);
  return parsed !== null && parsed >= minimum;
}

function meetsMaximum(value: number | null | undefined, maximum: number | null | undefined) {
  if (maximum === null || maximum === undefined) return true;
  const parsed = finite(value);
  return parsed !== null && parsed <= maximum;
}

function decisionModeMatches(entry: StrategyEntry, mode: StrategyDecisionMode) {
  if (mode === "ALL") return true;
  if (mode === "WATCHING") return entry.status === "WATCHING";
  if (mode === "SETTLED") return entry.status === "SETTLED";
  return entry.status === "PLAYED" || entry.status === "SETTLED" || entry.status === "VOID";
}

export function matchesStrategy(entry: StrategyEntry, strategy: StrategyConfig) {
  if (!decisionModeMatches(entry, strategy.decisionMode)) return false;
  if (strategy.leagueId && entry.leagueId !== strategy.leagueId) return false;
  if (strategy.seasonId && entry.seasonId !== strategy.seasonId) return false;
  if (strategy.statKey && entry.statKey !== strategy.statKey) return false;
  if (strategy.scope && entry.scope !== strategy.scope) return false;
  if (strategy.target && entry.target !== strategy.target) return false;
  if (strategy.side && entry.side !== strategy.side) return false;
  if (strategy.source && entry.source !== strategy.source) return false;
  if (strategy.modelVersion && entry.modelVersion !== strategy.modelVersion) return false;
  if (strategy.marketStatus && entry.marketStatus !== strategy.marketStatus) return false;
  if (strategy.evidenceStatus && entry.evidenceStatus !== strategy.evidenceStatus) return false;
  if (
    strategy.bookmaker
    && normalizedText(entry.bookmaker) !== normalizedText(strategy.bookmaker)
  ) return false;

  if (!meetsMinimum(entry.modelProbability, strategy.minModelProbability)) return false;
  if (!meetsMaximum(entry.modelProbability, strategy.maxModelProbability)) return false;
  if (!meetsMinimum(entry.expectedValue, strategy.minExpectedValue)) return false;
  if (!meetsMaximum(entry.expectedValue, strategy.maxExpectedValue)) return false;
  if (!meetsMinimum(entry.odds, strategy.minOdds)) return false;
  if (!meetsMaximum(entry.odds, strategy.maxOdds)) return false;
  if (!meetsMinimum(entry.threshold, strategy.minThreshold)) return false;
  if (!meetsMaximum(entry.threshold, strategy.maxThreshold)) return false;
  if (!meetsMinimum(entry.edge, strategy.minEdge)) return false;
  if (!meetsMinimum(entry.modelSample, strategy.minModelSample)) return false;
  if (!meetsMinimum(entry.modelCoverage, strategy.minCoverage)) return false;
  if (!meetsMinimum(entry.backtestSignals, strategy.minBacktestSignals)) return false;
  if (!meetsMinimum(entry.backtestHitRate, strategy.minBacktestHitRate)) return false;

  if (
    strategy.minimumConfidence
    && confidenceRank(entry.modelConfidence) < confidenceRank(strategy.minimumConfidence)
  ) return false;

  return true;
}

function chronological(entries: StrategyEntry[]) {
  return [...entries].sort(
    (left, right) =>
      left.kickoffAt.getTime() - right.kickoffAt.getTime()
      || left.decisionAt.getTime() - right.decisionAt.getTime()
      || left.id.localeCompare(right.id),
  );
}

function longestStreak(entries: StrategyEntry[], result: "WIN" | "LOSS") {
  let longest = 0;
  let current = 0;
  for (const entry of chronological(entries)) {
    if (entry.status !== "SETTLED" || (entry.result !== "WIN" && entry.result !== "LOSS")) {
      continue;
    }
    if (entry.result === result) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}


export function summarizeStrategy(entries: StrategyEntry[]): StrategyMetrics {
  const resolved = entries.filter(
    (entry) => entry.status === "SETTLED" && (entry.result === "WIN" || entry.result === "LOSS"),
  );
  const wins = resolved.filter((entry) => entry.result === "WIN").length;
  const losses = resolved.filter((entry) => entry.result === "LOSS").length;
  const calibrated = resolved.flatMap((entry) => {
    const probability = validProbability(entry.modelProbability);
    return probability === null ? [] : [{ entry, probability }];
  });
  const probabilities = calibrated.map((row) => row.probability);
  const calibratedWins = calibrated.filter((row) => row.entry.result === "WIN").length;
  const averageModelProbability = average(probabilities);
  const hitRate = percentage(wins, wins + losses);
  const calibrationHitRate = percentage(calibratedWins, calibrated.length);
  const brierValues = calibrated.map(({ entry, probability }) => {
    const outcome = entry.result === "WIN" ? 1 : 0;
    return ((probability / 100) - outcome) ** 2;
  });

  const financial = summarizeBettingFinancials({
    entries: entries.filter((entry) => entry.status === "SETTLED"),
    financialInput: (entry) => ({
      result: entry.result,
      odds: entry.odds,
      stake: entry.stake,
    }),
    compare: (left, right) =>
      left.kickoffAt.getTime() - right.kickoffAt.getTime()
      || left.decisionAt.getTime() - right.decisionAt.getTime()
      || left.id.localeCompare(right.id),
  });
  const expectedValues = entries.flatMap((entry) => {
    const value = finite(entry.expectedValue);
    return value === null ? [] : [value];
  });
  const odds = entries.flatMap((entry) => {
    const value = validOdds(entry.odds);
    return value === null ? [] : [value];
  });
  const clv = entries.flatMap((entry) => {
    const value = selectionClv({ odds: entry.odds, closingOdds: entry.closingOdds });
    return value === null ? [] : [value];
  });

  return {
    totalEntries: entries.length,
    openEntries: entries.filter(
      (entry) => !entry.result && (entry.status === "WATCHING" || entry.status === "PLAYED"),
    ).length,
    settledEntries: entries.filter((entry) => entry.status === "SETTLED").length,
    resolvedEntries: resolved.length,
    wins,
    losses,
    pushes: entries.filter((entry) => entry.status === "SETTLED" && entry.result === "PUSH").length,
    voided: entries.filter(
      (entry) => entry.status === "VOID" || entry.result === "VOID",
    ).length,
    hitRate,
    calibrationEntries: calibrated.length,
    calibrationHitRate,
    averageModelProbability,
    calibrationGap:
      calibrationHitRate !== null && averageModelProbability !== null
        ? calibrationHitRate - averageModelProbability
        : null,
    brierScore: average(brierValues),
    averageExpectedValue: average(expectedValues),
    averageOdds: average(odds),
    averageClv: average(clv),
    financialEntries: financial.financialEntries,
    turnover: financial.turnover,
    profit: financial.profit,
    roi: financial.roi,
    maxDrawdown: financial.maxDrawdown,
    longestWinStreak: longestStreak(entries, "WIN"),
    longestLossStreak: longestStreak(entries, "LOSS"),
    smallSample: resolved.length < 10,
  };
}

function stabilityFor(training: StrategyMetrics, validation: StrategyMetrics): StrategyStability {
  if (
    training.resolvedEntries < 10
    || validation.resolvedEntries < 10
    || training.calibrationEntries < 10
    || validation.calibrationEntries < 10
  ) return "INSUFFICIENT";
  if (
    training.calibrationHitRate === null
    || validation.calibrationHitRate === null
    || training.brierScore === null
    || validation.brierScore === null
  ) return "INSUFFICIENT";

  const hitGap = Math.abs(validation.calibrationHitRate - training.calibrationHitRate);
  const brierDeterioration = validation.brierScore - training.brierScore;
  const roiAcceptable =
    training.roi === null
    || validation.roi === null
    || validation.roi >= training.roi - 10;

  if (hitGap <= 8 && brierDeterioration <= 0.05 && roiAcceptable) return "STABLE";
  if (hitGap <= 15 && brierDeterioration <= 0.1) return "WATCH";
  return "UNSTABLE";
}

function segment(
  entries: StrategyEntry[],
  group: (entry: StrategyEntry) => { key: string; label: string },
) {
  const groups = new Map<string, { label: string; entries: StrategyEntry[] }>();
  for (const entry of entries) {
    const selected = group(entry);
    const current = groups.get(selected.key);
    if (current) current.entries.push(entry);
    else groups.set(selected.key, { label: selected.label, entries: [entry] });
  }
  return [...groups.entries()]
    .map(([key, value]) => ({ key, label: value.label, ...summarizeStrategy(value.entries) }))
    .sort(
      (left, right) =>
        right.resolvedEntries - left.resolvedEntries
        || right.totalEntries - left.totalEntries
        || left.label.localeCompare(right.label, "pl"),
    );
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", { year: "numeric", month: "long" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function byMonth(entries: StrategyEntry[]) {
  return segment(entries, (entry) => {
    const key = `${entry.kickoffAt.getUTCFullYear()}-${String(
      entry.kickoffAt.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    return { key, label: monthLabel(key) };
  }).sort((left, right) => right.key.localeCompare(left.key)) as StrategyMonthRow[];
}

export function evaluateStrategy(
  entries: StrategyEntry[],
  strategy: StrategyConfig,
  now = new Date(),
): StrategyEvaluation {
  const matchingEntries = chronological(entries.filter((entry) => matchesStrategy(entry, strategy)));
  const matchedEntries = matchingEntries.filter((entry) => isHistoricalDecisionEligible({
    decisionTiming: entry.decisionTiming,
    decisionAt: entry.decisionAt,
    kickoffAt: entry.kickoffAt,
  }));
  const excludedTimingEntries = matchingEntries.length - matchedEntries.length;
  const resolvedForSplit = matchedEntries.filter(
    (entry) => entry.status === "SETTLED" && (entry.result === "WIN" || entry.result === "LOSS"),
  );
  const trainingSize = resolvedForSplit.length < 2
    ? resolvedForSplit.length
    : Math.max(1, Math.floor(resolvedForSplit.length * 0.7));
  const trainingEntries = resolvedForSplit.slice(0, trainingSize);
  const validationEntries = resolvedForSplit.slice(trainingSize);
  const training = summarizeStrategy(trainingEntries);
  const validation = summarizeStrategy(validationEntries);

  return {
    config: strategy,
    matchedEntries,
    currentEntries: matchedEntries.filter(
      (entry) =>
        entry.kickoffAt.getTime() >= now.getTime()
        && !entry.result
        && (entry.status === "WATCHING" || entry.status === "PLAYED"),
    ),
    metrics: summarizeStrategy(matchedEntries),
    training,
    validation,
    stability: stabilityFor(training, validation),
    trainingEntries: trainingEntries.length,
    validationEntries: validationEntries.length,
    excludedTimingEntries,
    byMonth: byMonth(matchedEntries),
    byLeague: segment(matchedEntries, (entry) => ({
      key: entry.leagueId,
      label: entry.leagueName,
    })),
    byMarket: segment(matchedEntries, (entry) => ({
      key: entry.statKey,
      label: entry.statLabel,
    })),
    bySide: segment(matchedEntries, (entry) => ({ key: entry.side, label: entry.side })),
    byModelVersion: segment(matchedEntries, (entry) => {
      const version = entry.modelVersion?.trim() || "NONE";
      return { key: version, label: version === "NONE" ? "Brak wersji modelu" : version };
    }),
  };
}

export function strategyDecisionModeLabel(value: StrategyDecisionMode) {
  if (value === "PLAYED") return "Tylko decyzje zagrane";
  if (value === "SETTLED") return "Tylko rozliczone";
  if (value === "WATCHING") return "Tylko obserwowane";
  return "Wszystkie snapshoty";
}

export function strategyConfidenceLabel(value: StrategyConfidence | null | undefined) {
  if (value === "STRONG") return "mocna";
  if (value === "MEDIUM") return "średnia";
  if (value === "LIMITED") return "ograniczona";
  if (value === "WEAK") return "słaba";
  if (value === "NO_DATA") return "brak danych";
  return "dowolna";
}

export function strategyStabilityLabel(value: StrategyStability) {
  if (value === "STABLE") return "stabilna walidacja";
  if (value === "WATCH") return "wymaga obserwacji";
  if (value === "UNSTABLE") return "niestabilna walidacja";
  return "za mała próba walidacyjna";
}

export function strategyRuleSummary(strategy: StrategyConfig) {
  const parts: string[] = [strategyDecisionModeLabel(strategy.decisionMode)];
  if (strategy.statKey) parts.push(`rynek ${strategy.statKey}`);
  if (strategy.scope) {
    const labels: Record<string, string> = {
      MATCH_TOTAL: "suma meczu",
      TEAM_FOR: "suma drużyny",
      TEAM_AGAINST: "oddawane rywalom",
    };
    parts.push(labels[strategy.scope] ?? `zakres ${strategy.scope}`);
  }
  if (strategy.target) {
    const labels: Record<string, string> = {
      MATCH_TOTAL: "cały mecz",
      HOME_TEAM: "gospodarz",
      AWAY_TEAM: "gość",
    };
    parts.push(labels[strategy.target] ?? `cel ${strategy.target}`);
  }
  if (strategy.side) parts.push(strategy.side);
  if (strategy.minModelProbability !== null && strategy.minModelProbability !== undefined) {
    parts.push(`p modelu ≥ ${strategy.minModelProbability}%`);
  }
  if (strategy.maxModelProbability !== null && strategy.maxModelProbability !== undefined) {
    parts.push(`p modelu ≤ ${strategy.maxModelProbability}%`);
  }
  if (strategy.minExpectedValue !== null && strategy.minExpectedValue !== undefined) {
    parts.push(`EV ≥ ${strategy.minExpectedValue}%`);
  }
  if (strategy.maxExpectedValue !== null && strategy.maxExpectedValue !== undefined) {
    parts.push(`EV ≤ ${strategy.maxExpectedValue}%`);
  }
  if (strategy.minOdds !== null && strategy.minOdds !== undefined) parts.push(`kurs ≥ ${strategy.minOdds}`);
  if (strategy.maxOdds !== null && strategy.maxOdds !== undefined) parts.push(`kurs ≤ ${strategy.maxOdds}`);
  if (strategy.minThreshold !== null && strategy.minThreshold !== undefined) parts.push(`linia ≥ ${strategy.minThreshold}`);
  if (strategy.maxThreshold !== null && strategy.maxThreshold !== undefined) parts.push(`linia ≤ ${strategy.maxThreshold}`);
  if (strategy.minModelSample !== null && strategy.minModelSample !== undefined) {
    parts.push(`próba ≥ ${strategy.minModelSample}`);
  }
  if (strategy.minCoverage !== null && strategy.minCoverage !== undefined) {
    parts.push(`pokrycie ≥ ${strategy.minCoverage}%`);
  }
  if (strategy.minimumConfidence) {
    parts.push(`wiarygodność ≥ ${strategyConfidenceLabel(strategy.minimumConfidence)}`);
  }
  return parts.join(" · ");
}
