import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePlayPlan,
  type PlayPlanItemInput,
  type PlayPlanSettings,
} from "@/lib/stats/play-plan";

const settings: PlayPlanSettings = {
  bankroll: 1000,
  maxDailyStakePercent: 10,
  maxMatchStakePercent: 5,
  maxLeagueStakePercent: 8,
  maxMarketStakePercent: 8,
};

function item(overrides: Partial<PlayPlanItemInput> = {}): PlayPlanItemInput {
  return {
    id: "item-1",
    matchId: "match-1",
    leagueId: "league-1",
    statKey: "corners",
    scope: "MATCH_TOTAL",
    target: "MATCH",
    side: "OVER",
    threshold: 9.5,
    kickoffAt: new Date("2026-08-01T18:00:00Z"),
    priority: "TOP",
    score: 82,
    expectedValue: 8,
    plannedStake: 30,
    odds: 2.05,
    status: "SELECTED",
    ...overrides,
  };
}

const now = new Date("2026-08-01T10:00:00Z");

test("poprawny plan bez przekroczonych limitów można zatwierdzić", () => {
  const result = evaluatePlayPlan({ settings, items: [item()], now });
  assert.equal(result.approvable, true);
  assert.equal(result.totalStake, 30);
  assert.equal(result.expectedProfit, 2.4);
});

test("null EV pozostaje brakiem danych i nie jest zerem", () => {
  const result = evaluatePlayPlan({ settings, items: [item({ expectedValue: null })], now });
  assert.equal(result.expectedProfit, null);
  assert.equal(result.weightedExpectedValue, null);
  assert.equal(result.approvable, true);
  assert.ok(result.warnings.some((warning) => warning.includes("Brak EV")));
});

test("przeciwne kierunki dla tej samej linii blokują plan", () => {
  const result = evaluatePlayPlan({
    settings,
    now,
    items: [
      item({ id: "over" }),
      item({ id: "under", side: "UNDER" }),
    ],
  });
  assert.equal(result.approvable, false);
  assert.ok(result.blockers.some((blocker) => blocker.includes("przeciwne kierunki")));
});

test("przekroczenie limitu meczu blokuje plan", () => {
  const result = evaluatePlayPlan({
    settings,
    now,
    items: [item({ plannedStake: 60 })],
  });
  assert.equal(result.approvable, false);
  assert.ok(result.matchExposure[0]?.exceeded);
});

test("brak stawki nie jest traktowany jak zero", () => {
  const result = evaluatePlayPlan({
    settings,
    now,
    items: [item({ plannedStake: null })],
  });
  assert.equal(result.totalStake, 0);
  assert.equal(result.approvable, false);
  assert.ok(result.blockers.some((blocker) => blocker.includes("Brak prawidłowej stawki")));
});

test("rozpoczęty mecz blokuje niezagraną pozycję", () => {
  const result = evaluatePlayPlan({
    settings,
    now: new Date("2026-08-01T19:00:00Z"),
    items: [item()],
  });
  assert.equal(result.approvable, false);
  assert.ok(result.blockers.some((blocker) => blocker.includes("już się rozpoczął")));
});


test("pominięta pozycja nie blokuje planu ani ekspozycji", () => {
  const result = evaluatePlayPlan({
    settings,
    now: new Date("2026-08-01T19:00:00Z"),
    items: [
      item({ id: "active", plannedStake: 30, kickoffAt: new Date("2026-08-01T20:00:00Z") }),
      item({ id: "skipped", status: "SKIPPED", plannedStake: 500, side: "UNDER" }),
    ],
  });
  assert.equal(result.skippedItems, 1);
  assert.equal(result.totalStake, 30);
  assert.equal(result.matchExposure[0]?.stake, 30);
  assert.equal(result.itemAssessments.skipped?.blockers.length, 0);
});


test("pozycja zagrana poza planem blokuje zatwierdzenie snapshotu", () => {
  const result = evaluatePlayPlan({
    settings,
    now: new Date("2026-08-01T19:00:00Z"),
    items: [item({ actualStatus: "PLAYED" })],
  });
  assert.equal(result.approvable, false);
  assert.ok(result.blockers.some((blocker) => blocker.includes("poza planem")));
});
