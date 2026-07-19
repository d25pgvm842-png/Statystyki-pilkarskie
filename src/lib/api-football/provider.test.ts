import assert from "node:assert/strict";
import test from "node:test";
import { MatchStatus } from "@/generated/prisma/enums";
import {
  apiSeasonYear,
  normalizeFixtureStats,
  normalizeFixtureStatus,
  parseRound,
  type ApiFootballFixture,
} from "@/lib/api-football/provider";

const fixture: ApiFootballFixture = {
  fixture: { id: 1, date: "2026-07-20T18:00:00+00:00", status: { short: "FT" } },
  league: { id: 39, season: 2026, round: "Regular Season - 3" },
  teams: { home: { id: 10, name: "A" }, away: { id: 20, name: "B" } },
  goals: { home: 2, away: 1 },
  statistics: [
    { team: { id: 10 }, statistics: [
      { type: "Corner Kicks", value: 7 },
      { type: "Yellow Cards", value: 3 },
      { type: "Red Cards", value: null },
      { type: "Shots on Goal", value: 6 },
      { type: "Total Shots", value: 14 },
      { type: "Fouls", value: 12 },
      { type: "Offsides", value: 2 },
    ] },
    { team: { id: 20 }, statistics: [
      { type: "Corner Kicks", value: 4 },
      { type: "Yellow Cards", value: 5 },
      { type: "Red Cards", value: 1 },
      { type: "Shots on Goal", value: 3 },
      { type: "Total Shots", value: 8 },
      { type: "Fouls", value: 16 },
      { type: "Offsides", value: 1 },
    ] },
  ],
};

test("normalizuje statystyki obu drużyn", () => {
  assert.deepEqual(normalizeFixtureStats(fixture), {
    homeCorners: 7,
    awayCorners: 4,
    homeYellowCards: 3,
    awayYellowCards: 5,
    homeRedCards: null,
    awayRedCards: 1,
    homeShotsOnTarget: 6,
    awayShotsOnTarget: 3,
    homeShots: 14,
    awayShots: 8,
    homeFouls: 12,
    awayFouls: 16,
    homeOffsides: 2,
    awayOffsides: 1,
  });
});

test("mapuje statusy API na statusy aplikacji", () => {
  assert.equal(normalizeFixtureStatus("FT"), MatchStatus.FINISHED);
  assert.equal(normalizeFixtureStatus("2H"), MatchStatus.LIVE);
  assert.equal(normalizeFixtureStatus("PST"), MatchStatus.POSTPONED);
  assert.equal(normalizeFixtureStatus("CANC"), MatchStatus.CANCELLED);
  assert.equal(normalizeFixtureStatus("NS"), MatchStatus.SCHEDULED);
});

test("wyciąga numer kolejki", () => {
  assert.equal(parseRound("Regular Season - 28"), 28);
  assert.equal(parseRound("Round 3"), 3);
  assert.equal(parseRound(null), null);
});

test("sezon API jest rokiem rozpoczęcia", () => {
  assert.equal(apiSeasonYear(new Date("2026-07-01T00:00:00.000Z")), 2026);
});
