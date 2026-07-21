import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateDailyRecommendation,
  selectBestStrategySupport,
  type DailyRecommendationInput,
  type DailyStrategySupport,
} from "@/lib/stats/daily-recommendations";

function strategy(overrides: Partial<DailyStrategySupport> = {}): DailyStrategySupport {
  return {
    strategyVersionId: "version-1",
    strategyName: "Value konserwatywne",
    version: 1,
    operationalStatus: "APPROVED",
    healthStatus: "HEALTHY",
    healthScore: 88,
    exposureStatus: "OK",
    recommendedStake: 20,
    stakeMode: "FIXED",
    ...overrides,
  };
}

function input(overrides: Partial<DailyRecommendationInput> = {}): DailyRecommendationInput {
  return {
    id: "pick-1",
    matchId: "match-1",
    kickoffAt: new Date("2026-08-01T18:00:00Z"),
    status: "WATCHING",
    source: "MANUAL",
    odds: 2.05,
    modelProbability: 57,
    expectedValue: 8,
    modelSample: 24,
    modelCoverage: 92,
    modelConfidence: "STRONG",
    marketStatus: "POTENTIAL_VALUE",
    evidenceStatus: "SUPPORTED",
    backtestSignals: 30,
    backtestHitRate: 58,
    edgeBacktestSignals: 12,
    edgeBacktestHitRate: 58,
    conflict: false,
    strategies: [strategy()],
    ...overrides,
  };
}

test("pełny sygnał value ze zdrową strategią dostaje priorytet A", () => {
  const result = evaluateDailyRecommendation(input());
  assert.equal(result.priority, "TOP");
  assert.ok(result.score >= 75);
  assert.equal(result.hasSafeStrategy, true);
});

test("brak strategii nie blokuje dobrego sygnału, ale nie daje priorytetu A", () => {
  const result = evaluateDailyRecommendation(input({ strategies: [] }));
  assert.equal(result.priority, "VALUE");
  assert.equal(result.hasSafeStrategy, false);
});

test("null kursu i EV pozostają brakiem danych", () => {
  const result = evaluateDailyRecommendation(input({ odds: null, expectedValue: null }));
  assert.equal(result.priority, "WATCH");
  assert.equal(result.missingMarketData, true);
  assert.ok(result.warnings.some((item) => item.includes("Brak EV")));
});

test("NO_EDGE zawsze blokuje rekomendację", () => {
  const result = evaluateDailyRecommendation(input({ marketStatus: "NO_EDGE" }));
  assert.equal(result.priority, "BLOCKED");
  assert.ok(result.blockers.some((item) => item.includes("nie wykazuje przewagi")));
});

test("sprzeczne kierunki blokują oba sygnały", () => {
  const result = evaluateDailyRecommendation(input({ conflict: true }));
  assert.equal(result.priority, "BLOCKED");
  assert.ok(result.blockers.some((item) => item.includes("Sprzeczne kierunki")));
});

test("wyłącznie zatrzymana strategia blokuje sygnał", () => {
  const result = evaluateDailyRecommendation(input({
    strategies: [strategy({ healthStatus: "STOPPED", healthScore: 25 })],
  }));
  assert.equal(result.priority, "BLOCKED");
});

test("zdrowa strategia wygrywa z zatrzymaną przy wyborze wsparcia", () => {
  const best = selectBestStrategySupport([
    strategy({ strategyVersionId: "stopped", healthStatus: "STOPPED", healthScore: 20 }),
    strategy({ strategyVersionId: "healthy", healthStatus: "HEALTHY", healthScore: 80 }),
  ]);
  assert.equal(best?.strategyVersionId, "healthy");
});

test("ostrzeżenie jednej strategii nie blokuje, gdy inna jest bezpieczna", () => {
  const result = evaluateDailyRecommendation(input({
    strategies: [
      strategy({ strategyVersionId: "warning", exposureStatus: "DAILY_LIMIT" }),
      strategy({ strategyVersionId: "safe", healthScore: 82 }),
    ],
  }));
  assert.notEqual(result.priority, "BLOCKED");
  assert.equal(result.hasExposureWarning, true);
  assert.equal(result.hasSafeStrategy, true);
});
