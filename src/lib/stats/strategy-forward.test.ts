import assert from "node:assert/strict";
import test from "node:test";
import {
  assessForwardExposure,
  calculateForwardStakePlan,
  forwardBankrollAtDecision,
  isForwardDecisionEligible,
  summarizeForwardSignals,
  type ForwardStakeSettings,
} from "@/lib/stats/strategy-forward";

const settings: ForwardStakeSettings = {
  stakeMode: "KELLY",
  fixedStake: 10,
  initialBankroll: 1000,
  bankrollPercent: 1,
  kellyFraction: 0.25,
  maxStakePercent: 3,
  maxMatchExposurePercent: 5,
  maxLeagueExposurePercent: 15,
  maxMarketExposurePercent: 15,
  maxDailyExposurePercent: 20,
};

test("Kelly pozostaje null bez kursu lub prawdopodobieństwa", () => {
  assert.equal(calculateForwardStakePlan({
    settings,
    modelProbability: null,
    odds: 2,
  }).kellyStake, null);
  assert.equal(calculateForwardStakePlan({
    settings,
    modelProbability: 60,
    odds: null,
  }).recommendedStake, null);
});

test("Kelly jest ograniczony limitem maksymalnej stawki", () => {
  const result = calculateForwardStakePlan({
    settings,
    modelProbability: 90,
    odds: 3,
  });
  assert.equal(result.kellyStake, 30);
  assert.equal(result.recommendedStake, 30);
});

test("ekspozycja oznacza przekroczenie limitu meczu", () => {
  const result = assessForwardExposure({
    settings: { ...settings, maxMatchExposurePercent: 2 },
    proposed: {
      matchId: "m1",
      leagueId: "l1",
      statKey: "corners",
      kickoffAt: new Date("2026-08-01T18:00:00Z"),
      recommendedStake: 15,
    },
    existing: [{
      matchId: "m1",
      leagueId: "l1",
      statKey: "cards",
      kickoffAt: new Date("2026-08-01T18:00:00Z"),
      recommendedStake: 10,
    }],
  });
  assert.match(result, /MATCH_LIMIT/);
});

test("ROI, CLV i drawdown są liczone bez zamiany null na zero", () => {
  const metrics = summarizeForwardSignals([
    {
      id: "1",
      decisionAt: new Date("2026-01-01T10:00:00Z"),
      kickoffAt: new Date("2026-01-02T10:00:00Z"),
      oddsAtSignal: 2,
      closingOdds: 1.8,
      result: "WIN",
      fixedStake: 10,
      percentageStake: 10,
      kellyStake: 5,
      recommendedStake: 5,
      exposureStatus: "OK",
    },
    {
      id: "2",
      decisionAt: new Date("2026-01-03T10:00:00Z"),
      kickoffAt: new Date("2026-01-04T10:00:00Z"),
      oddsAtSignal: 2,
      closingOdds: null,
      result: "LOSS",
      fixedStake: 10,
      percentageStake: 10,
      kellyStake: null,
      recommendedStake: null,
      exposureStatus: "NO_STAKE_DATA",
    },
  ]);

  assert.equal(metrics.clvEntries, 1);
  assert.equal(metrics.kelly.financialEntries, 1);
  assert.equal(metrics.selected.financialEntries, 1);
  assert.equal(metrics.fixed.roi, 0);
  assert.equal(metrics.fixed.maxDrawdown, 10);
});



test("procent kapitału i Kelly używają kapitału z chwili sygnału", () => {
  const bankroll = forwardBankrollAtDecision({
    initialBankroll: 1000,
    decisionAt: new Date("2026-01-05T10:00:00Z"),
    entries: [
      {
        id: "win",
        settledAt: new Date("2026-01-04T20:00:00Z"),
        oddsAtSignal: 2,
        result: "WIN",
        fixedStake: 100,
        percentageStake: 100,
        kellyStake: 100,
        recommendedStake: 100,
      },
      {
        id: "future-loss",
        settledAt: new Date("2026-01-06T20:00:00Z"),
        oddsAtSignal: 2,
        result: "LOSS",
        fixedStake: 100,
        percentageStake: 100,
        kellyStake: 100,
        recommendedStake: 100,
      },
    ],
    variant: "SELECTED",
  });
  assert.equal(bankroll, 1100);
  const result = calculateForwardStakePlan({
    settings: { ...settings, stakeMode: "BANKROLL_PERCENT", bankrollPercent: 2 },
    modelProbability: 60,
    odds: 2,
    percentageBankroll: bankroll,
    kellyBankroll: bankroll,
  });
  assert.equal(result.percentageStake, 22);
  assert.equal(result.recommendedStake, 22);
});

test("push zwiększa obrót, a void nie", () => {
  const base = {
    decisionAt: new Date("2026-01-01T10:00:00Z"),
    kickoffAt: new Date("2026-01-02T10:00:00Z"),
    oddsAtSignal: 2,
    closingOdds: 2,
    fixedStake: 10,
    percentageStake: 10,
    kellyStake: 10,
    recommendedStake: 10,
    exposureStatus: "OK",
  };
  const metrics = summarizeForwardSignals([
    { ...base, id: "void", result: "VOID" },
    { ...base, id: "push", result: "PUSH" },
  ]);
  assert.equal(metrics.fixed.financialEntries, 1);
  assert.equal(metrics.fixed.turnover, 10);
  assert.equal(metrics.fixed.profit, 0);
  assert.equal(metrics.fixed.roi, 0);
});

test("test forward nie przyjmuje decyzji wstecz ani po rozpoczęciu meczu", () => {
  const activatedAt = new Date("2026-07-20T12:00:00Z");
  const kickoffAt = new Date("2026-07-21T18:00:00Z");
  assert.equal(isForwardDecisionEligible({
    activatedAt,
    decisionAt: new Date("2026-07-20T11:59:59Z"),
    capturedAt: new Date("2026-07-20T12:00:00Z"),
    kickoffAt,
  }), false);
  assert.equal(isForwardDecisionEligible({
    activatedAt,
    decisionAt: kickoffAt,
    capturedAt: kickoffAt,
    kickoffAt,
  }), false);
  assert.equal(isForwardDecisionEligible({
    activatedAt,
    decisionAt: new Date("2026-07-20T12:00:01Z"),
    capturedAt: new Date("2026-07-20T12:00:02Z"),
    kickoffAt,
  }), true);
  assert.equal(isForwardDecisionEligible({
    activatedAt,
    decisionAt: new Date("2026-07-20T12:00:01Z"),
    capturedAt: kickoffAt,
    kickoffAt,
  }), false);
});
