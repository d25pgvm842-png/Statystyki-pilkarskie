import assert from "node:assert/strict";
import test from "node:test";
import {
  BETTING_METRICS_VERSION,
  bettingFinancialContribution,
  summarizeBettingFinancials,
} from "@/lib/stats/betting-metrics";

test("kontrakt metryk ma jawną wersję", () => {
  assert.equal(BETTING_METRICS_VERSION, "1.0.0");
});

test("PUSH wchodzi do obrotu, a VOID nie", () => {
  assert.deepEqual(
    bettingFinancialContribution({ result: "PUSH", odds: 1.9, stake: 100 }),
    { profit: 0, turnover: 100, countsAsFinancialEntry: true },
  );
  assert.deepEqual(
    bettingFinancialContribution({ result: "VOID", odds: 1.9, stake: 100 }),
    { profit: 0, turnover: 0, countsAsFinancialEntry: false },
  );
});

test("brak kursu lub stawki pozostaje brakiem dla WIN LOSS PUSH", () => {
  assert.equal(bettingFinancialContribution({ result: "WIN", odds: null, stake: 100 }), null);
  assert.equal(bettingFinancialContribution({ result: "LOSS", odds: 2, stake: null }), null);
  assert.equal(bettingFinancialContribution({ result: "PUSH", odds: null, stake: 100 }), null);
});

test("wspólny agregator liczy obrót ROI i drawdown", () => {
  const entries = [
    { order: 1, result: "WIN" as const, odds: 2, stake: 100 },
    { order: 2, result: "PUSH" as const, odds: 2, stake: 50 },
    { order: 3, result: "LOSS" as const, odds: 2, stake: 100 },
    { order: 4, result: "VOID" as const, odds: 2, stake: 500 },
  ];
  const summary = summarizeBettingFinancials({
    entries,
    financialInput: (entry) => entry,
    compare: (left, right) => left.order - right.order,
  });
  assert.equal(summary.financialEntries, 3);
  assert.equal(summary.turnover, 250);
  assert.equal(summary.profit, 0);
  assert.equal(summary.roi, 0);
  assert.equal(summary.maxDrawdown, 100);
});
