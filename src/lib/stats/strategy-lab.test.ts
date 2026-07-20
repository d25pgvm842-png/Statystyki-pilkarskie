import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateStrategy,
  matchesStrategy,
  strategyRuleSummary,
  summarizeStrategy,
  type StrategyConfig,
  type StrategyEntry,
} from "@/lib/stats/strategy-lab";

function entry(overrides: Partial<StrategyEntry> = {}): StrategyEntry {
  return {
    id: overrides.id ?? "pick-1",
    matchId: overrides.matchId ?? "match-1",
    kickoffAt: overrides.kickoffAt ?? new Date("2026-01-01T12:00:00.000Z"),
    createdAt: overrides.createdAt ?? new Date("2025-12-30T12:00:00.000Z"),
    quoteCapturedAt: overrides.quoteCapturedAt ?? null,
    leagueId: overrides.leagueId ?? "league-1",
    leagueName: overrides.leagueName ?? "Liga testowa",
    seasonId: overrides.seasonId ?? "season-1",
    seasonName: overrides.seasonName ?? "2025/26",
    homeTeamName: overrides.homeTeamName ?? "Dom",
    awayTeamName: overrides.awayTeamName ?? "Gość",
    statKey: overrides.statKey ?? "corners",
    statLabel: overrides.statLabel ?? "Rzuty rożne",
    threshold: overrides.threshold ?? 9.5,
    scope: overrides.scope ?? "MATCH_TOTAL",
    target: overrides.target ?? "MATCH_TOTAL",
    side: overrides.side ?? "OVER",
    source: overrides.source ?? "SCANNER",
    status: overrides.status ?? "SETTLED",
    result: overrides.result === undefined ? "WIN" : overrides.result,
    odds: overrides.odds === undefined ? 2 : overrides.odds,
    closingOdds: overrides.closingOdds === undefined ? 1.9 : overrides.closingOdds,
    stake: overrides.stake === undefined ? 100 : overrides.stake,
    projection: overrides.projection === undefined ? 11 : overrides.projection,
    edge: overrides.edge === undefined ? 1.5 : overrides.edge,
    evidenceStatus: overrides.evidenceStatus ?? "SUPPORTED",
    backtestSignals: overrides.backtestSignals === undefined ? 30 : overrides.backtestSignals,
    backtestHitRate: overrides.backtestHitRate === undefined ? 60 : overrides.backtestHitRate,
    modelProbability: overrides.modelProbability === undefined ? 60 : overrides.modelProbability,
    expectedValue: overrides.expectedValue === undefined ? 20 : overrides.expectedValue,
    modelSample: overrides.modelSample === undefined ? 20 : overrides.modelSample,
    modelCoverage: overrides.modelCoverage === undefined ? 100 : overrides.modelCoverage,
    modelConfidence: overrides.modelConfidence ?? "STRONG",
    modelVersion: overrides.modelVersion ?? "market-workshop-v1.0",
    marketStatus: overrides.marketStatus ?? "POTENTIAL_VALUE",
    bookmaker: overrides.bookmaker ?? "Testbet",
  };
}

const baseStrategy: StrategyConfig = {
  name: "Test",
  decisionMode: "ALL",
};

test("brak wartości nie spełnia aktywnego progu strategii", () => {
  assert.equal(matchesStrategy(entry({ expectedValue: null }), {
    ...baseStrategy,
    minExpectedValue: 5,
  }), false);
  assert.equal(matchesStrategy(entry({ expectedValue: null }), baseStrategy), true);
});

test("strategia łączy progi, filtry i minimalną wiarygodność", () => {
  const strategy: StrategyConfig = {
    ...baseStrategy,
    leagueId: "league-1",
    statKey: "corners",
    target: "MATCH_TOTAL",
    side: "OVER",
    minModelProbability: 55,
    minExpectedValue: 5,
    minOdds: 1.8,
    maxOdds: 2.5,
    minThreshold: 8.5,
    maxThreshold: 10.5,
    minModelSample: 10,
    minCoverage: 70,
    minimumConfidence: "MEDIUM",
  };
  assert.equal(matchesStrategy(entry(), strategy), true);
  assert.equal(matchesStrategy(entry({ modelConfidence: "LIMITED" }), strategy), false);
  assert.equal(matchesStrategy(entry({ odds: 2.6 }), strategy), false);
  assert.equal(matchesStrategy(entry({ threshold: 11.5 }), strategy), false);
  assert.equal(matchesStrategy(entry({ target: "HOME_TEAM" }), strategy), false);
  assert.equal(matchesStrategy(entry({ side: "UNDER" }), strategy), false);
});

test("tryb PLAYED nie używa obserwowanych ani odrzuconych decyzji", () => {
  const strategy = { ...baseStrategy, decisionMode: "PLAYED" as const };
  assert.equal(matchesStrategy(entry({ status: "PLAYED", result: null }), strategy), true);
  assert.equal(matchesStrategy(entry({ status: "SETTLED" }), strategy), true);
  assert.equal(matchesStrategy(entry({ status: "WATCHING", result: null }), strategy), false);
  assert.equal(matchesStrategy(entry({ status: "REJECTED", result: null }), strategy), false);
});

test("metryki liczą ROI, CLV, Brier, serie i obsunięcie", () => {
  const entries = [
    entry({ id: "1", kickoffAt: new Date("2026-01-01T12:00:00Z"), result: "WIN", modelProbability: 60 }),
    entry({ id: "2", kickoffAt: new Date("2026-01-02T12:00:00Z"), result: "WIN", modelProbability: 60 }),
    entry({ id: "3", kickoffAt: new Date("2026-01-03T12:00:00Z"), result: "LOSS", modelProbability: 60 }),
    entry({ id: "4", kickoffAt: new Date("2026-01-04T12:00:00Z"), result: "LOSS", modelProbability: 60 }),
  ];
  const metrics = summarizeStrategy(entries);
  assert.equal(metrics.resolvedEntries, 4);
  assert.equal(metrics.hitRate, 50);
  assert.equal(metrics.turnover, 400);
  assert.equal(metrics.profit, 0);
  assert.equal(metrics.roi, 0);
  assert.equal(metrics.longestWinStreak, 2);
  assert.equal(metrics.longestLossStreak, 2);
  assert.equal(metrics.maxDrawdown, 200);
  assert.ok(metrics.brierScore !== null && metrics.brierScore > 0);
  assert.ok(metrics.averageClv !== null && metrics.averageClv > 0);
});

test("brak kursu nie tworzy wyniku finansowego", () => {
  const metrics = summarizeStrategy([
    entry({ odds: null, closingOdds: null, stake: 100, result: "WIN" }),
  ]);
  assert.equal(metrics.financialEntries, 0);
  assert.equal(metrics.turnover, 0);
  assert.equal(metrics.profit, 0);
  assert.equal(metrics.roi, null);
  assert.equal(metrics.maxDrawdown, null);
});

test("kalibracja pomija starsze wpisy bez probability zamiast mieszać mianowniki", () => {
  const metrics = summarizeStrategy([
    entry({ id: "with-probability", result: "WIN", modelProbability: 60 }),
    entry({ id: "without-probability", result: "LOSS", modelProbability: null }),
  ]);
  assert.equal(metrics.resolvedEntries, 2);
  assert.equal(metrics.hitRate, 50);
  assert.equal(metrics.calibrationEntries, 1);
  assert.equal(metrics.calibrationHitRate, 100);
  assert.equal(metrics.averageModelProbability, 60);
  assert.equal(metrics.calibrationGap, 40);
});

test("walidacja 70/30 jest chronologiczna i używa późniejszych decyzji", () => {
  const entries = Array.from({ length: 20 }, (_, index) => entry({
    id: String(index),
    kickoffAt: new Date(Date.UTC(2026, 0, index + 1)),
    result: index < 14 ? "WIN" : "LOSS",
  }));
  const evaluation = evaluateStrategy(entries, baseStrategy, new Date("2027-01-01T00:00:00Z"));
  assert.equal(evaluation.trainingEntries, 14);
  assert.equal(evaluation.validationEntries, 6);
  assert.equal(evaluation.training.wins, 14);
  assert.equal(evaluation.validation.losses, 6);
  assert.equal(evaluation.stability, "INSUFFICIENT");
});

test("stabilność jest liczona dopiero przy wystarczającej próbie obu części", () => {
  const entries = Array.from({ length: 40 }, (_, index) => entry({
    id: String(index),
    kickoffAt: new Date(Date.UTC(2026, 0, index + 1)),
    result: index % 2 === 0 ? "WIN" : "LOSS",
    modelProbability: 50,
    odds: 2,
  }));
  const evaluation = evaluateStrategy(entries, baseStrategy, new Date("2027-01-01T00:00:00Z"));
  assert.equal(evaluation.trainingEntries, 28);
  assert.equal(evaluation.validationEntries, 12);
  assert.equal(evaluation.stability, "STABLE");
});

test("wynik zawiera segmenty miesięczne, ligowe i aktualne kandydatury", () => {
  const entries = [
    entry({ id: "past", kickoffAt: new Date("2026-01-01T12:00:00Z") }),
    entry({
      id: "future",
      kickoffAt: new Date("2026-08-01T12:00:00Z"),
      status: "WATCHING",
      result: null,
      leagueId: "league-2",
      leagueName: "Druga liga",
      statKey: "shots",
      statLabel: "Strzały",
    }),
  ];
  const evaluation = evaluateStrategy(entries, baseStrategy, new Date("2026-07-01T00:00:00Z"));
  assert.equal(evaluation.currentEntries.length, 1);
  assert.equal(evaluation.byLeague.length, 2);
  assert.equal(evaluation.byMarket.length, 2);
  assert.equal(evaluation.byMonth.length, 2);
});

test("opis reguły pokazuje najważniejsze warunki", () => {
  const summary = strategyRuleSummary({
    ...baseStrategy,
    target: "MATCH_TOTAL",
    side: "OVER",
    minModelProbability: 55,
    minExpectedValue: 5,
    minModelSample: 10,
    minCoverage: 70,
    minimumConfidence: "MEDIUM",
  });
  assert.match(summary, /OVER/);
  assert.match(summary, /EV ≥ 5%/);
  assert.match(summary, /próba ≥ 10/);
});
