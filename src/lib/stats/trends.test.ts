import test from "node:test";
import assert from "node:assert/strict";
import { analyzeTrendLine, extractTrendValues } from "./trends";

const matches = [
  {
    kickoffAt: "2026-07-03T18:00:00.000Z",
    homeTeamId: "a",
    awayTeamId: "b",
    stats: { homeCorners: 7, awayCorners: 4, homeYellowCards: 2, awayYellowCards: 3 },
  },
  {
    kickoffAt: "2026-07-02T18:00:00.000Z",
    homeTeamId: "c",
    awayTeamId: "a",
    stats: { homeCorners: 3, awayCorners: 6, homeYellowCards: 1, awayYellowCards: 4 },
  },
  {
    kickoffAt: "2026-07-01T18:00:00.000Z",
    homeTeamId: "a",
    awayTeamId: "d",
    stats: { homeCorners: 5, awayCorners: 5, homeYellowCards: 2, awayYellowCards: 2 },
  },
];

test("extracts match totals newest first", () => {
  const values = extractTrendValues(matches, {
    statKey: "corners",
    scope: "MATCH_TOTAL",
  });

  assert.deepEqual(values.map((item) => item.value), [11, 9, 10]);
});

test("extracts team production for home matches only", () => {
  const values = extractTrendValues(matches, {
    statKey: "corners",
    scope: "TEAM_FOR",
    teamId: "a",
    venue: "HOME",
  });

  assert.deepEqual(values.map((item) => item.value), [7, 5]);
});

test("extracts values allowed by a team and respects lookback", () => {
  const values = extractTrendValues(matches, {
    statKey: "yellowCards",
    scope: "TEAM_AGAINST",
    teamId: "a",
    limit: 2,
  });

  assert.deepEqual(values.map((item) => item.value), [3, 1]);
});

test("calculates over under push rates and current streak", () => {
  const values = [7, 6, 6, 4].map((value, index) => ({
    value,
    kickoffAt: new Date(2026, 6, 10 - index),
    venue: "HOME" as const,
  }));

  const result = analyzeTrendLine(values, 5);

  assert.equal(result.overCount, 3);
  assert.equal(result.underCount, 1);
  assert.equal(result.pushCount, 0);
  assert.equal(result.overRate, 75);
  assert.deepEqual(result.streak, { result: "OVER", length: 3 });
  assert.equal(result.average, 5.75);
  assert.equal(result.median, 6);
});

test("treats an exact integer line as push", () => {
  const values = [5, 5, 4].map((value, index) => ({
    value,
    kickoffAt: new Date(2026, 6, 10 - index),
    venue: null,
  }));

  const result = analyzeTrendLine(values, 5);

  assert.equal(result.pushCount, 2);
  assert.equal(result.pushRate, (2 / 3) * 100);
  assert.deepEqual(result.streak, { result: "PUSH", length: 2 });
});
