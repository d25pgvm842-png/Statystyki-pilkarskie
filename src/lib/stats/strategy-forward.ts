import {
  selectionClv,
  selectionProfit,
  type JournalResult,
} from "@/lib/stats/analysis-journal";
import { summarizeBettingFinancials } from "@/lib/stats/betting-metrics";

export type ForwardStakeMode = "FIXED" | "BANKROLL_PERCENT" | "KELLY";

export type ForwardStakeSettings = {
  stakeMode: ForwardStakeMode;
  fixedStake: number;
  initialBankroll: number;
  bankrollPercent: number;
  kellyFraction: number;
  maxStakePercent: number;
  maxMatchExposurePercent: number;
  maxLeagueExposurePercent: number;
  maxMarketExposurePercent: number;
  maxDailyExposurePercent: number;
};

export type ForwardStakePlan = {
  fixedStake: number;
  percentageStake: number;
  kellyStake: number | null;
  recommendedStake: number | null;
};

export type ForwardExposureInput = {
  matchId: string;
  leagueId: string;
  statKey: string;
  kickoffAt: Date;
  recommendedStake: number | null;
};

export type ForwardExposureExisting = ForwardExposureInput;

export type ForwardBankrollEntry = {
  id: string;
  settledAt: Date | null;
  oddsAtSignal: number | null;
  result: JournalResult | null;
  fixedStake: number;
  percentageStake: number;
  kellyStake: number | null;
  recommendedStake: number | null;
};

export type ForwardBankrollVariant = "FIXED" | "PERCENTAGE" | "KELLY" | "SELECTED";

export type ForwardSignalMetricEntry = {
  id: string;
  decisionAt: Date;
  kickoffAt: Date;
  oddsAtSignal: number | null;
  closingOdds: number | null;
  result: JournalResult | null;
  fixedStake: number;
  percentageStake: number;
  kellyStake: number | null;
  recommendedStake: number | null;
  exposureStatus: string;
};

export type ForwardFinancialMetrics = {
  financialEntries: number;
  turnover: number;
  profit: number;
  roi: number | null;
  maxDrawdown: number | null;
};

export type ForwardMetrics = {
  totalSignals: number;
  openSignals: number;
  resolvedSignals: number;
  wins: number;
  losses: number;
  pushes: number;
  voided: number;
  hitRate: number | null;
  clvEntries: number;
  averageClv: number | null;
  exposureWarnings: number;
  fixed: ForwardFinancialMetrics;
  percentage: ForwardFinancialMetrics;
  kelly: ForwardFinancialMetrics;
  selected: ForwardFinancialMetrics;
};

function finitePositive(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function kellyStake(input: {
  bankroll: number;
  probability: number | null;
  odds: number | null;
  fraction: number;
  maxStakePercent: number;
}) {
  const bankroll = finitePositive(input.bankroll);
  const odds = finitePositive(input.odds);
  if (
    bankroll === null
    || odds === null
    || odds <= 1
    || input.probability === null
    || !Number.isFinite(input.probability)
    || input.probability <= 0
    || input.probability >= 100
  ) return null;

  const p = input.probability / 100;
  const b = odds - 1;
  const q = 1 - p;
  const fullKelly = ((b * p) - q) / b;
  if (!Number.isFinite(fullKelly) || fullKelly <= 0) return null;

  const fraction = Math.max(0, Math.min(input.fraction, 1));
  const cap = bankroll * (Math.max(0, input.maxStakePercent) / 100);
  const stake = bankroll * fullKelly * fraction;
  return money(Math.min(stake, cap));
}

export function forwardBankrollAtDecision(input: {
  initialBankroll: number;
  decisionAt: Date;
  entries: ForwardBankrollEntry[];
  variant: ForwardBankrollVariant;
}) {
  const initial = finitePositive(input.initialBankroll) ?? 0;
  const profit = input.entries.reduce((total, entry) => {
    if (!entry.settledAt || entry.settledAt.getTime() > input.decisionAt.getTime()) {
      return total;
    }
    if (entry.result !== "WIN" && entry.result !== "LOSS") return total;
    const stake = input.variant === "FIXED"
      ? entry.fixedStake
      : input.variant === "PERCENTAGE"
        ? entry.percentageStake
        : input.variant === "KELLY"
          ? entry.kellyStake
          : entry.recommendedStake;
    const value = selectionProfit({
      result: entry.result,
      odds: entry.oddsAtSignal,
      stake,
    });
    return value === null ? total : total + value;
  }, 0);
  return money(Math.max(0, initial + profit));
}

export function isForwardDecisionEligible(input: {
  activatedAt: Date;
  decisionAt: Date;
  capturedAt: Date;
  kickoffAt: Date;
  endedAt?: Date | null;
}) {
  if (input.decisionAt.getTime() < input.activatedAt.getTime()) return false;
  if (input.decisionAt.getTime() > input.capturedAt.getTime()) return false;
  if (input.decisionAt.getTime() >= input.kickoffAt.getTime()) return false;
  if (input.capturedAt.getTime() >= input.kickoffAt.getTime()) return false;
  if (input.endedAt && input.decisionAt.getTime() >= input.endedAt.getTime()) return false;
  return true;
}

export function calculateForwardStakePlan(input: {
  settings: ForwardStakeSettings;
  modelProbability: number | null;
  odds: number | null;
  percentageBankroll?: number;
  kellyBankroll?: number;
}): ForwardStakePlan {
  const percentageBankroll = Math.max(
    0,
    input.percentageBankroll ?? input.settings.initialBankroll,
  );
  const kellyBankroll = Math.max(
    0,
    input.kellyBankroll ?? input.settings.initialBankroll,
  );
  const fixedStake = money(Math.max(0.01, input.settings.fixedStake));
  const percentageStake = money(
    Math.max(0, percentageBankroll * (input.settings.bankrollPercent / 100)),
  );
  const calculatedKelly = kellyStake({
    bankroll: kellyBankroll,
    probability: input.modelProbability,
    odds: input.odds,
    fraction: input.settings.kellyFraction,
    maxStakePercent: input.settings.maxStakePercent,
  });

  const recommendedStake = input.settings.stakeMode === "FIXED"
    ? fixedStake
    : input.settings.stakeMode === "BANKROLL_PERCENT"
      ? (percentageStake > 0 ? percentageStake : null)
      : calculatedKelly;

  return {
    fixedStake,
    percentageStake,
    kellyStake: calculatedKelly,
    recommendedStake,
  };
}

function utcDayRange(value: Date) {
  const start = new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
  ));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function assessForwardExposure(input: {
  proposed: ForwardExposureInput;
  existing: ForwardExposureExisting[];
  settings: ForwardStakeSettings;
  bankroll?: number;
}) {
  const stake = finitePositive(input.proposed.recommendedStake);
  if (stake === null) return "NO_STAKE_DATA";

  const bankroll = Math.max(0.01, input.bankroll ?? input.settings.initialBankroll);
  const day = utcDayRange(input.proposed.kickoffAt);
  const relevant = input.existing.filter((row) => {
    const rowStake = finitePositive(row.recommendedStake);
    return rowStake !== null;
  });

  const sum = (predicate: (row: ForwardExposureExisting) => boolean) => relevant
    .filter(predicate)
    .reduce((total, row) => total + (row.recommendedStake as number), stake);

  const warnings: string[] = [];
  const matchExposure = sum((row) => row.matchId === input.proposed.matchId);
  const leagueExposure = sum(
    (row) => row.leagueId === input.proposed.leagueId
      && row.kickoffAt >= day.start
      && row.kickoffAt < day.end,
  );
  const marketExposure = sum(
    (row) => row.statKey === input.proposed.statKey
      && row.kickoffAt >= day.start
      && row.kickoffAt < day.end,
  );
  const dailyExposure = sum(
    (row) => row.kickoffAt >= day.start && row.kickoffAt < day.end,
  );

  if ((matchExposure / bankroll) * 100 > input.settings.maxMatchExposurePercent) {
    warnings.push("MATCH_LIMIT");
  }
  if ((leagueExposure / bankroll) * 100 > input.settings.maxLeagueExposurePercent) {
    warnings.push("LEAGUE_LIMIT");
  }
  if ((marketExposure / bankroll) * 100 > input.settings.maxMarketExposurePercent) {
    warnings.push("MARKET_LIMIT");
  }
  if ((dailyExposure / bankroll) * 100 > input.settings.maxDailyExposurePercent) {
    warnings.push("DAILY_LIMIT");
  }

  return warnings.length ? warnings.join(",") : "OK";
}

function financialMetrics(
  entries: ForwardSignalMetricEntry[],
  stake: (entry: ForwardSignalMetricEntry) => number | null,
): ForwardFinancialMetrics {
  const financial = summarizeBettingFinancials({
    entries,
    financialInput: (entry) => ({
      result: entry.result,
      odds: entry.oddsAtSignal,
      stake: stake(entry),
    }),
    compare: (left, right) =>
      left.kickoffAt.getTime() - right.kickoffAt.getTime()
      || left.decisionAt.getTime() - right.decisionAt.getTime()
      || left.id.localeCompare(right.id),
  });

  return financial;
}

export function summarizeForwardSignals(entries: ForwardSignalMetricEntry[]): ForwardMetrics {
  const resolved = entries.filter(
    (entry) => entry.result === "WIN" || entry.result === "LOSS",
  );
  const wins = resolved.filter((entry) => entry.result === "WIN").length;
  const losses = resolved.filter((entry) => entry.result === "LOSS").length;
  const clv = entries.flatMap((entry) => {
    const value = selectionClv({
      odds: entry.oddsAtSignal,
      closingOdds: entry.closingOdds,
    });
    return value === null ? [] : [value];
  });

  return {
    totalSignals: entries.length,
    openSignals: entries.filter((entry) => entry.result === null).length,
    resolvedSignals: resolved.length,
    wins,
    losses,
    pushes: entries.filter((entry) => entry.result === "PUSH").length,
    voided: entries.filter((entry) => entry.result === "VOID").length,
    hitRate: percentage(wins, wins + losses),
    clvEntries: clv.length,
    averageClv: average(clv),
    exposureWarnings: entries.filter((entry) => entry.exposureStatus !== "OK").length,
    fixed: financialMetrics(entries, (entry) => entry.fixedStake),
    percentage: financialMetrics(entries, (entry) => entry.percentageStake),
    kelly: financialMetrics(entries, (entry) => entry.kellyStake),
    selected: financialMetrics(entries, (entry) => entry.recommendedStake),
  };
}

export function forwardStakeModeLabel(value: ForwardStakeMode) {
  if (value === "BANKROLL_PERCENT") return "% kapitału";
  if (value === "KELLY") return "częściowy Kelly";
  return "stała stawka";
}
