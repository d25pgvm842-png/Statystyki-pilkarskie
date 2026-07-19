import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMarketRatings,
  marketRatingBucketLabel,
  type RatingMatch,
} from "@/lib/stats/market-ratings";

const teams = [
  { id: "A", name: "Alpha" },
  { id: "B", name: "Beta" },
  { id: "C", name: "Gamma" },
];

function match(input: {
  id: string;
  date: string;
  home: string;
  away: string;
  homeCorners?: number | null;
  awayCorners?: number | null;
}): RatingMatch {
  return {
    id: input.id,
    kickoffAt: new Date(input.date),
    homeTeamId: input.home,
    awayTeamId: input.away,
    stats: {
      homeCorners: input.homeCorners ?? null,
      awayCorners: input.awayCorners ?? null,
    },
  };
}

test("rating 0-100 porządkuje drużyny według średniej", () => {
  const result = buildMarketRatings({
    teams,
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: 8, awayCorners: 4 }),
      match({ id: "2", date: "2026-01-02", home: "C", away: "A", homeCorners: 6, awayCorners: 7 }),
      match({ id: "3", date: "2026-01-03", home: "B", away: "C", homeCorners: 3, awayCorners: 5 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "ALL",
    lookback: null,
    minSample: 1,
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  const beta = result.rows.find((row) => row.teamId === "B");
  assert.equal(alpha?.position, 1);
  assert.equal(alpha?.rating, 100);
  assert.equal(beta?.rating, 0);
  assert.equal(marketRatingBucketLabel(alpha?.bucket ?? null), "wysoki");
});

test("remisy otrzymują ten sam percentyl i pozycję", () => {
  const result = buildMarketRatings({
    teams,
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: 5, awayCorners: 5 }),
      match({ id: "2", date: "2026-01-02", home: "C", away: "A", homeCorners: 2, awayCorners: 5 }),
      match({ id: "3", date: "2026-01-03", home: "B", away: "C", homeCorners: 5, awayCorners: 2 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "ALL",
    lookback: null,
    minSample: 1,
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  const beta = result.rows.find((row) => row.teamId === "B");
  assert.equal(alpha?.position, beta?.position);
  assert.equal(alpha?.rating, beta?.rating);
});

test("filtr miejsca i lookback liczą ostatnie 5 meczów domowych drużyny", () => {
  const result = buildMarketRatings({
    teams: teams.slice(0, 2),
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: 100, awayCorners: 1 }),
      match({ id: "2", date: "2026-01-02", home: "A", away: "B", homeCorners: 2, awayCorners: 2 }),
      match({ id: "3", date: "2026-01-03", home: "A", away: "B", homeCorners: 3, awayCorners: 3 }),
      match({ id: "4", date: "2026-01-04", home: "A", away: "B", homeCorners: 4, awayCorners: 4 }),
      match({ id: "5", date: "2026-01-05", home: "A", away: "B", homeCorners: 5, awayCorners: 5 }),
      match({ id: "6", date: "2026-01-06", home: "A", away: "B", homeCorners: 6, awayCorners: 6 }),
      match({ id: "7", date: "2026-01-07", home: "B", away: "A", homeCorners: 1, awayCorners: 50 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "HOME",
    lookback: 5,
    minSample: 1,
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  assert.equal(alpha?.sample, 5);
  assert.equal(alpha?.average, 4);
});

test("brak statystyki nie jest zamieniany na zero", () => {
  const result = buildMarketRatings({
    teams: teams.slice(0, 2),
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: null, awayCorners: 4 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "ALL",
    lookback: null,
    minSample: 1,
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  assert.equal(alpha?.sample, 0);
  assert.equal(alpha?.average, null);
  assert.equal(alpha?.rating, null);
});

test("minimum próby wyklucza rating, ale zachowuje średnią informacyjną", () => {
  const result = buildMarketRatings({
    teams: teams.slice(0, 2),
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: 7, awayCorners: 3 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "ALL",
    lookback: null,
    minSample: 3,
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  assert.equal(alpha?.average, 7);
  assert.equal(alpha?.eligible, false);
  assert.equal(alpha?.rating, null);
});

test("granica czasu usuwa przyszłe mecze z ratingu", () => {
  const result = buildMarketRatings({
    teams: teams.slice(0, 2),
    matches: [
      match({ id: "1", date: "2026-01-01", home: "A", away: "B", homeCorners: 4, awayCorners: 4 }),
      match({ id: "2", date: "2026-02-01", home: "A", away: "B", homeCorners: 10, awayCorners: 2 }),
    ],
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "ALL",
    lookback: null,
    minSample: 1,
    before: new Date("2026-01-15"),
  });

  const alpha = result.rows.find((row) => row.teamId === "A");
  assert.equal(alpha?.sample, 1);
  assert.equal(alpha?.average, 4);
});
