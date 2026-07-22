import {
  bettingFinancialContribution,
  summarizeBettingFinancials,
  type BettingResult,
} from "@/lib/stats/betting-metrics";
import { selectionClv } from "@/lib/stats/analysis-journal";

export const PLAY_PLAN_SKIP_REASONS = [
  { code: "ODDS_CHANGED", label: "Kurs stracił wartość" },
  { code: "MARKET_UNAVAILABLE", label: "Rynek był niedostępny" },
  { code: "EXPOSURE_LIMIT", label: "Limit ekspozycji" },
  { code: "NEW_INFORMATION", label: "Nowa informacja przed meczem" },
  { code: "DISCIPLINE", label: "Decyzja dyscyplinarna" },
  { code: "OTHER", label: "Inny powód" },
] as const;

export type PlayPlanSkipReasonCode = (typeof PLAY_PLAN_SKIP_REASONS)[number]["code"];

export function isPlayPlanSkipReasonCode(value: string): value is PlayPlanSkipReasonCode {
  return PLAY_PLAN_SKIP_REASONS.some((reason) => reason.code === value);
}

export function playPlanSkipReasonLabel(value: string | null | undefined) {
  if (!value) return null;
  return PLAY_PLAN_SKIP_REASONS.find((reason) => reason.code === value)?.label ?? value;
}

export type PlayPlanActual = {
  status: string;
  result: BettingResult | null;
  odds: number | null;
  closingOdds: number | null;
  stake: number | null;
  bookmaker: string | null;
  placedAt: Date | null;
  settledAt: Date | null;
  actualValue: number | null;
};

export type PlayPlanReconciliationInput = {
  itemStatus: string;
  capturedAt: Date;
  plannedStake: number | null;
  plannedOdds: number | null;
  plannedBookmaker: string | null;
  skipReasonCode: string | null;
  skipNote: string | null;
  skippedAt: Date | null;
  actual: PlayPlanActual;
};

export type PlayPlanReconciliation = {
  lifecycleStatus: "SELECTED" | "PLAYED" | "SETTLED" | "VOID" | "SKIPPED";
  executed: boolean;
  settled: boolean;
  plannedStake: number | null;
  actualStake: number | null;
  stakeDelta: number | null;
  stakeDeltaPercent: number | null;
  plannedOdds: number | null;
  actualOdds: number | null;
  oddsDelta: number | null;
  plannedBookmaker: string | null;
  actualBookmaker: string | null;
  bookmakerChanged: boolean | null;
  capturedAt: Date;
  placedAt: Date | null;
  executionDelayMinutes: number | null;
  result: BettingResult | null;
  actualValue: number | null;
  settledAt: Date | null;
  profit: number | null;
  clv: number | null;
  skipReasonCode: string | null;
  skipReasonLabel: string | null;
  skipNote: string | null;
  skippedAt: Date | null;
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizedBookmaker(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase("pl") ?? "";
  return normalized || null;
}

export function reconcilePlayPlanItem(input: PlayPlanReconciliationInput): PlayPlanReconciliation {
  const skipped = input.itemStatus === "SKIPPED";
  const executed = ["PLAYED", "SETTLED", "VOID"].includes(input.actual.status);
  const settled = input.actual.status === "SETTLED" || input.actual.status === "VOID";
  const plannedStake = finite(input.plannedStake);
  const actualStake = executed ? finite(input.actual.stake) : null;
  const plannedOdds = finite(input.plannedOdds);
  const actualOdds = executed ? finite(input.actual.odds) : null;
  const stakeDelta = plannedStake !== null && actualStake !== null
    ? money(actualStake - plannedStake)
    : null;
  const stakeDeltaPercent = plannedStake !== null && plannedStake > 0 && stakeDelta !== null
    ? (stakeDelta / plannedStake) * 100
    : null;
  const oddsDelta = plannedOdds !== null && actualOdds !== null
    ? Math.round((actualOdds - plannedOdds) * 1000) / 1000
    : null;
  const plannedBookmaker = input.plannedBookmaker?.trim() || null;
  const actualBookmaker = executed ? input.actual.bookmaker?.trim() || null : null;
  const plannedBookmakerNormalized = normalizedBookmaker(plannedBookmaker);
  const actualBookmakerNormalized = normalizedBookmaker(actualBookmaker);
  const bookmakerChanged = plannedBookmakerNormalized && actualBookmakerNormalized
    ? plannedBookmakerNormalized !== actualBookmakerNormalized
    : null;
  const placedAt = executed ? input.actual.placedAt : null;
  const executionDelayMinutes = placedAt
    ? Math.round((placedAt.getTime() - input.capturedAt.getTime()) / 60000)
    : null;
  const contribution = settled
    ? bettingFinancialContribution({
        result: input.actual.result,
        odds: input.actual.odds,
        stake: input.actual.stake,
      })
    : null;
  const clv = settled
    ? selectionClv({ odds: input.actual.odds, closingOdds: input.actual.closingOdds })
    : null;
  const lifecycleStatus = input.actual.status === "VOID"
    ? "VOID"
    : input.actual.status === "SETTLED"
      ? "SETTLED"
      : executed
        ? "PLAYED"
        : skipped
          ? "SKIPPED"
          : "SELECTED";

  return {
    lifecycleStatus,
    executed,
    settled,
    plannedStake,
    actualStake,
    stakeDelta,
    stakeDeltaPercent,
    plannedOdds,
    actualOdds,
    oddsDelta,
    plannedBookmaker,
    actualBookmaker,
    bookmakerChanged,
    capturedAt: input.capturedAt,
    placedAt,
    executionDelayMinutes,
    result: settled ? input.actual.result : null,
    actualValue: settled ? input.actual.actualValue : null,
    settledAt: settled ? input.actual.settledAt : null,
    profit: contribution?.profit ?? null,
    clv,
    skipReasonCode: skipped ? input.skipReasonCode : null,
    skipReasonLabel: skipped ? playPlanSkipReasonLabel(input.skipReasonCode) : null,
    skipNote: skipped ? input.skipNote : null,
    skippedAt: skipped ? input.skippedAt : null,
  };
}

export type PlayPlanDaySummaryItem = {
  itemStatus: string;
  plannedStake: number | null;
  actual: PlayPlanActual;
};

export type PlayPlanDaySummary = {
  totalItems: number;
  selectedItems: number;
  playedItems: number;
  settledItems: number;
  voidItems: number;
  skippedItems: number;
  plannedStake: number;
  executedStake: number;
  executedPlannedStake: number;
  stakeDifference: number;
  executionRate: number | null;
  financialEntries: number;
  turnover: number | null;
  profit: number | null;
  roi: number | null;
  averageClv: number | null;
};

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizePlayPlanDay(items: PlayPlanDaySummaryItem[]): PlayPlanDaySummary {
  const executedItems = items.filter((item) => ["PLAYED", "SETTLED", "VOID"].includes(item.actual.status));
  const settledItems = items.filter((item) => item.actual.status === "SETTLED");
  const voidItems = items.filter((item) => item.actual.status === "VOID");
  const skippedItems = items.filter((item) => item.itemStatus === "SKIPPED");
  const selectedItems = items.filter((item) => item.itemStatus === "SELECTED" && !["PLAYED", "SETTLED", "VOID"].includes(item.actual.status));
  const plannedStake = money(items.reduce((sum, item) => sum + (finite(item.plannedStake) ?? 0), 0));
  const executedStake = money(executedItems.reduce((sum, item) => sum + (finite(item.actual.stake) ?? 0), 0));
  const executedPlannedStake = money(executedItems.reduce((sum, item) => sum + (finite(item.plannedStake) ?? 0), 0));
  const financial = summarizeBettingFinancials({
    entries: [...settledItems, ...voidItems],
    financialInput: (item) => item.actual,
    compare: (left, right) => {
      const leftTime = left.actual.settledAt?.getTime() ?? left.actual.placedAt?.getTime() ?? 0;
      const rightTime = right.actual.settledAt?.getTime() ?? right.actual.placedAt?.getTime() ?? 0;
      return leftTime - rightTime;
    },
  });
  const clvValues = [...settledItems, ...voidItems]
    .map((item) => selectionClv({ odds: item.actual.odds, closingOdds: item.actual.closingOdds }))
    .filter((value): value is number => value !== null);
  const hasSettlement = settledItems.length + voidItems.length > 0;

  return {
    totalItems: items.length,
    selectedItems: selectedItems.length,
    playedItems: executedItems.filter((item) => item.actual.status === "PLAYED").length,
    settledItems: settledItems.length,
    voidItems: voidItems.length,
    skippedItems: skippedItems.length,
    plannedStake,
    executedStake,
    executedPlannedStake,
    stakeDifference: money(executedStake - executedPlannedStake),
    executionRate: items.length > 0 ? (executedItems.length / items.length) * 100 : null,
    financialEntries: financial.financialEntries,
    turnover: hasSettlement ? financial.turnover : null,
    profit: hasSettlement ? financial.profit : null,
    roi: financial.roi,
    averageClv: average(clvValues),
  };
}
