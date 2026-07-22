import assert from "node:assert/strict";
import test from "node:test";
import {
  isPlayPlanSkipReasonCode,
  reconcilePlayPlanItem,
  summarizePlayPlanDay,
} from "./play-plan-reconciliation";

const capturedAt = new Date("2026-07-22T08:00:00.000Z");

function actual(overrides: Partial<Parameters<typeof reconcilePlayPlanItem>[0]["actual"]> = {}) {
  return {
    status: "WATCHING",
    result: null,
    odds: null,
    closingOdds: null,
    stake: null,
    bookmaker: null,
    placedAt: null,
    settledAt: null,
    actualValue: null,
    ...overrides,
  };
}

test("recognizes only structured skip reasons", () => {
  assert.equal(isPlayPlanSkipReasonCode("ODDS_CHANGED"), true);
  assert.equal(isPlayPlanSkipReasonCode("FREE_TEXT"), false);
});

test("keeps selected item without fake actual values", () => {
  const row = reconcilePlayPlanItem({
    itemStatus: "SELECTED",
    capturedAt,
    plannedStake: 20,
    plannedOdds: 1.9,
    plannedBookmaker: "Book A",
    skipReasonCode: null,
    skipNote: null,
    skippedAt: null,
    actual: actual(),
  });
  assert.equal(row.lifecycleStatus, "SELECTED");
  assert.equal(row.actualStake, null);
  assert.equal(row.profit, null);
});

test("calculates plan versus actual differences", () => {
  const row = reconcilePlayPlanItem({
    itemStatus: "PLAYED",
    capturedAt,
    plannedStake: 20,
    plannedOdds: 1.9,
    plannedBookmaker: "Book A",
    skipReasonCode: null,
    skipNote: null,
    skippedAt: null,
    actual: actual({
      status: "PLAYED",
      stake: 25,
      odds: 1.84,
      bookmaker: "Book B",
      placedAt: new Date("2026-07-22T08:15:00.000Z"),
    }),
  });
  assert.equal(row.stakeDelta, 5);
  assert.equal(row.stakeDeltaPercent, 25);
  assert.equal(row.oddsDelta, -0.06);
  assert.equal(row.bookmakerChanged, true);
  assert.equal(row.executionDelayMinutes, 15);
});

test("settled row uses actual pick for profit and CLV", () => {
  const row = reconcilePlayPlanItem({
    itemStatus: "PLAYED",
    capturedAt,
    plannedStake: 20,
    plannedOdds: 1.9,
    plannedBookmaker: "Book A",
    skipReasonCode: null,
    skipNote: null,
    skippedAt: null,
    actual: actual({
      status: "SETTLED",
      result: "WIN",
      stake: 25,
      odds: 2,
      closingOdds: 1.8,
      bookmaker: "Book A",
      placedAt: new Date("2026-07-22T08:15:00.000Z"),
      settledAt: new Date("2026-07-22T20:00:00.000Z"),
      actualValue: 12,
    }),
  });
  assert.equal(row.lifecycleStatus, "SETTLED");
  assert.equal(row.profit, 25);
  assert.ok(row.clv !== null && row.clv > 11 && row.clv < 12);
});

test("skipped item never becomes executed", () => {
  const row = reconcilePlayPlanItem({
    itemStatus: "SKIPPED",
    capturedAt,
    plannedStake: 20,
    plannedOdds: 1.9,
    plannedBookmaker: "Book A",
    skipReasonCode: "ODDS_CHANGED",
    skipNote: "Spadek do 1.60",
    skippedAt: new Date("2026-07-22T08:10:00.000Z"),
    actual: actual(),
  });
  assert.equal(row.lifecycleStatus, "SKIPPED");
  assert.equal(row.executed, false);
  assert.equal(row.skipReasonLabel, "Kurs stracił wartość");
});

test("daily summary uses AnalysisPick as actual source of truth", () => {
  const summary = summarizePlayPlanDay([
    {
      itemStatus: "PLAYED",
      plannedStake: 20,
      actual: actual({ status: "SETTLED", result: "WIN", stake: 25, odds: 2, closingOdds: 1.9, settledAt: new Date("2026-07-22T20:00:00.000Z") }),
    },
    {
      itemStatus: "PLAYED",
      plannedStake: 20,
      actual: actual({ status: "SETTLED", result: "LOSS", stake: 10, odds: 2, closingOdds: 2.1, settledAt: new Date("2026-07-22T21:00:00.000Z") }),
    },
    { itemStatus: "SKIPPED", plannedStake: 15, actual: actual() },
  ]);
  assert.equal(summary.plannedStake, 55);
  assert.equal(summary.executedStake, 35);
  assert.equal(summary.executedPlannedStake, 40);
  assert.equal(summary.stakeDifference, -5);
  assert.equal(summary.skippedItems, 1);
  assert.ok(summary.executionRate !== null && summary.executionRate > 66 && summary.executionRate < 67);
  assert.equal(summary.profit, 15);
  assert.equal(summary.turnover, 35);
  assert.ok(summary.roi !== null && summary.roi > 42 && summary.roi < 43);
});


test("daily summary keeps financial values null before any settlement", () => {
  const summary = summarizePlayPlanDay([
    { itemStatus: "SELECTED", plannedStake: 20, actual: actual() },
    { itemStatus: "PLAYED", plannedStake: 15, actual: actual({ status: "PLAYED", stake: 15, odds: 1.9 }) },
  ]);
  assert.equal(summary.turnover, null);
  assert.equal(summary.profit, null);
  assert.equal(summary.roi, null);
});


test("actual execution remains visible even when the plan item was previously skipped", () => {
  const row = reconcilePlayPlanItem({
    itemStatus: "SKIPPED",
    capturedAt,
    plannedStake: 20,
    plannedOdds: 1.9,
    plannedBookmaker: "Book A",
    skipReasonCode: "ODDS_CHANGED",
    skipNote: null,
    skippedAt: new Date("2026-07-22T08:10:00.000Z"),
    actual: actual({
      status: "PLAYED",
      stake: 10,
      odds: 1.8,
      bookmaker: "Book B",
      placedAt: new Date("2026-07-22T09:00:00.000Z"),
    }),
  });
  assert.equal(row.lifecycleStatus, "PLAYED");
  assert.equal(row.executed, true);
  assert.equal(row.skipReasonCode, "ODDS_CHANGED");
});
