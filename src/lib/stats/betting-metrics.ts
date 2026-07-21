export const BETTING_METRICS_VERSION = "1.0.0";

export type BettingResult = "WIN" | "LOSS" | "PUSH" | "VOID";

export type BettingFinancialInput = {
  result: BettingResult | null;
  odds: number | null;
  stake: number | null;
};

export type BettingFinancialContribution = {
  profit: number;
  turnover: number;
  countsAsFinancialEntry: boolean;
};

export type BettingFinancialSummary = {
  financialEntries: number;
  turnover: number;
  profit: number;
  roi: number | null;
  maxDrawdown: number | null;
};

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function validStake(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function validOdds(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 1
    ? value
    : null;
}

/**
 * Wersja 1.0 kontraktu finansowego:
 * - WIN/LOSS/PUSH wymagają kompletnej stawki i kursu,
 * - PUSH ma profit 0 i wchodzi do obrotu,
 * - VOID ma profit 0, nie wchodzi do obrotu i nie zwiększa liczby pozycji finansowych,
 * - brak danych pozostaje brakiem, nigdy fikcyjnym zerem.
 */
export function bettingFinancialContribution(
  input: BettingFinancialInput,
): BettingFinancialContribution | null {
  if (!input.result) return null;
  if (input.result === "VOID") {
    return { profit: 0, turnover: 0, countsAsFinancialEntry: false };
  }

  const stake = validStake(input.stake);
  const odds = validOdds(input.odds);
  if (stake === null || odds === null) return null;

  if (input.result === "LOSS") {
    return { profit: -stake, turnover: stake, countsAsFinancialEntry: true };
  }
  if (input.result === "PUSH") {
    return { profit: 0, turnover: stake, countsAsFinancialEntry: true };
  }
  return {
    profit: money(stake * (odds - 1)),
    turnover: stake,
    countsAsFinancialEntry: true,
  };
}

export function summarizeBettingFinancials<T>(input: {
  entries: T[];
  financialInput: (entry: T) => BettingFinancialInput;
  compare?: (left: T, right: T) => number;
}): BettingFinancialSummary {
  const rows = input.entries.flatMap((entry) => {
    const contribution = bettingFinancialContribution(input.financialInput(entry));
    return contribution?.countsAsFinancialEntry
      ? [{ entry, contribution }]
      : [];
  });

  const turnover = money(rows.reduce((sum, row) => sum + row.contribution.turnover, 0));
  const profit = money(rows.reduce((sum, row) => sum + row.contribution.profit, 0));

  let maxDrawdown: number | null = null;
  if (rows.length) {
    let cumulative = 0;
    let peak = 0;
    let maximum = 0;
    const ordered = input.compare
      ? [...rows].sort((left, right) => input.compare!(left.entry, right.entry))
      : rows;
    for (const row of ordered) {
      cumulative += row.contribution.profit;
      peak = Math.max(peak, cumulative);
      maximum = Math.max(maximum, peak - cumulative);
    }
    maxDrawdown = money(maximum);
  }

  return {
    financialEntries: rows.length,
    turnover,
    profit,
    roi: turnover > 0 ? (profit / turnover) * 100 : null,
    maxDrawdown,
  };
}
