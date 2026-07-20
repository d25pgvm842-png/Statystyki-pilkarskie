import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStrategyHealth,
  wilsonInterval,
  type StrategyHealthMetricSet,
} from "@/lib/stats/strategy-monitoring";

const historical: StrategyHealthMetricSet = {
  resolvedEntries: 100,
  wins: 58,
  losses: 42,
  hitRate: 58,
  roi: 8,
  averageClv: 3,
  maxDrawdown: 90,
  profit: 80,
  turnover: 1000,
  financialEntries: 100,
};

function forward(overrides: Partial<StrategyHealthMetricSet> = {}): StrategyHealthMetricSet {
  return {
    resolvedEntries: 30,
    wins: 17,
    losses: 13,
    hitRate: 56.67,
    roi: 6,
    averageClv: 2,
    maxDrawdown: 80,
    profit: 60,
    turnover: 1000,
    financialEntries: 30,
    ...overrides,
  };
}

const settings = {
  minForwardSample: 20,
  maxDrawdownPercent: 15,
  maxLossPercent: 10,
};

test("Wilson nie zwraca przedziału bez próby", () => {
  assert.equal(wilsonInterval({ wins: 0, total: 0 }), null);
});

test("Wilson zwraca poprawny przedział dla trafności", () => {
  const interval = wilsonInterval({ wins: 58, total: 100 });
  assert.ok(interval);
  assert.ok(interval.lower > 48 && interval.lower < 49);
  assert.ok(interval.upper > 67 && interval.upper < 68);
});

test("mała próba nigdy nie zatrzymuje strategii", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({
      resolvedEntries: 5,
      wins: 0,
      losses: 5,
      roi: -100,
      averageClv: -20,
      maxDrawdown: 500,
      profit: -500,
      financialEntries: 5,
    }),
    initialBankroll: 1000,
    exposureWarnings: 10,
    settings,
  });

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.hardStop, false);
  assert.equal(result.score, null);
});

test("brak danych finansowych nie jest zerem ani stopem", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({
      roi: null,
      averageClv: null,
      maxDrawdown: null,
      profit: 0,
      turnover: 0,
      financialEntries: 0,
    }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.status, "INSUFFICIENT_DATA");
  assert.equal(result.score, null);
  assert.equal(result.drawdownPercent, null);
});

test("spójny forward daje zdrową strategię", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ roi: 7, averageClv: 2.5, maxDrawdown: 40 }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.status, "HEALTHY");
  assert.ok(result.score !== null && result.score >= 75);
});

test("umiarkowane pogorszenie kieruje do obserwacji", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ roi: 1, averageClv: -0.5, maxDrawdown: 90 }),
    initialBankroll: 1000,
    exposureWarnings: 1,
    settings,
  });

  assert.equal(result.status, "WATCH");
  assert.ok(result.score !== null && result.score < 75);
});

test("silne pogorszenie ROI i CLV oznacza zagrożenie", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ roi: -15, averageClv: -5, maxDrawdown: 120, profit: -80 }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.status, "AT_RISK");
  assert.equal(result.hardStop, false);
});

test("limit drawdown działa dopiero po minimalnej próbie", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ maxDrawdown: 160 }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.status, "STOPPED");
  assert.equal(result.hardStop, true);
  assert.equal(result.drawdownPercent, 16);
  assert.ok(result.score !== null && result.score <= 35);
});

test("limit straty działa niezależnie od dodatniego historycznego ROI", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ profit: -110, roi: -11 }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.status, "STOPPED");
  assert.equal(result.lossPercent, 11);
});

test("ujemne wartości nie są tworzone przy dodatnim wyniku", () => {
  const result = evaluateStrategyHealth({
    historical,
    forward: forward({ profit: 120 }),
    initialBankroll: 1000,
    exposureWarnings: 0,
    settings,
  });

  assert.equal(result.lossPercent, 0);
});
