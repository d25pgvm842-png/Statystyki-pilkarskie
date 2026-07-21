import assert from "node:assert/strict";
import test from "node:test";
import { summarizeJournal } from "@/lib/stats/analysis-journal";
import { summarizeCalibration } from "@/lib/stats/journal-calibration";
import { summarizeForwardSignals } from "@/lib/stats/strategy-forward";
import { summarizeStrategy, type StrategyEntry } from "@/lib/stats/strategy-lab";

const results = [
  { id: "win", result: "WIN" as const, odds: 2, stake: 100 },
  { id: "loss", result: "LOSS" as const, odds: 2, stake: 100 },
  { id: "push", result: "PUSH" as const, odds: 1.8, stake: 50 },
  { id: "void", result: "VOID" as const, odds: 1.9, stake: 200 },
];

function strategyEntry(item: (typeof results)[number], index: number): StrategyEntry {
  const kickoffAt = new Date(Date.UTC(2026, 0, index + 2, 18));
  const decisionAt = new Date(Date.UTC(2026, 0, index + 1, 12));
  return {
    id: item.id,
    matchId: `match-${item.id}`,
    kickoffAt,
    createdAt: decisionAt,
    quoteCapturedAt: decisionAt,
    decisionAt,
    decisionTiming: "PRE_MATCH",
    leagueId: "league",
    leagueName: "Liga",
    seasonId: "season",
    seasonName: "2025/26",
    homeTeamName: "Dom",
    awayTeamName: "Gość",
    statKey: "corners",
    statLabel: "Rzuty rożne",
    threshold: 9.5,
    scope: "MATCH_TOTAL",
    target: "MATCH_TOTAL",
    side: "OVER",
    source: "MANUAL",
    status: "SETTLED",
    result: item.result,
    odds: item.odds,
    closingOdds: 1.9,
    stake: item.stake,
    projection: 10,
    edge: 0.5,
    evidenceStatus: "SUPPORTED",
    backtestSignals: 20,
    backtestHitRate: 55,
    modelProbability: 55,
    expectedValue: 5,
    modelSample: 20,
    modelCoverage: 100,
    modelConfidence: "MEDIUM",
    modelVersion: "v1",
    marketStatus: "POTENTIAL_VALUE",
    bookmaker: "Test",
  };
}

test("Dziennik Kalibracja Strategie i Forward używają tego samego kontraktu finansowego", () => {
  const journal = summarizeJournal(results.map((item) => ({
    status: "SETTLED",
    result: item.result,
    odds: item.odds,
    closingOdds: 1.9,
    stake: item.stake,
  })));

  const calibration = summarizeCalibration(results.map((item) => ({
    status: "SETTLED",
    result: item.result,
    odds: item.odds,
    stake: item.stake,
    modelProbability: 55,
    expectedValue: 5,
    modelVersion: "v1",
    leagueId: "league",
    leagueName: "Liga",
    statKey: "corners",
    statLabel: "Rzuty rożne",
    side: "OVER",
  })));

  const strategy = summarizeStrategy(results.map(strategyEntry));

  const forward = summarizeForwardSignals(results.map((item, index) => ({
    id: item.id,
    decisionAt: new Date(Date.UTC(2026, 0, index + 1, 12)),
    kickoffAt: new Date(Date.UTC(2026, 0, index + 2, 18)),
    oddsAtSignal: item.odds,
    closingOdds: 1.9,
    result: item.result,
    fixedStake: item.stake,
    percentageStake: item.stake,
    kellyStake: item.stake,
    recommendedStake: item.stake,
    exposureStatus: "OK",
  })));

  for (const metrics of [journal, calibration, strategy, forward.fixed]) {
    assert.equal(metrics.financialEntries, 3);
    assert.equal(metrics.turnover, 250);
    assert.equal(metrics.profit, 0);
    assert.equal(metrics.roi, 0);
  }
});
