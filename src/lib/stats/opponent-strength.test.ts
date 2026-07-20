import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpponentStrengthProfile,
  opponentRatingScope,
  type OpponentStrengthProfile,
} from "@/lib/stats/opponent-strength";
import type { RatingMatch } from "@/lib/stats/market-ratings";

const teams = [
  { id: "A", name: "Alpha" },
  { id: "B", name: "Beta" },
  { id: "C", name: "Gamma" },
  { id: "D", name: "Delta" },
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

function profile(overrides: Partial<Parameters<typeof buildOpponentStrengthProfile>[0]> = {}): OpponentStrengthProfile {
  const matches: RatingMatch[] = [
    match({ id: "setup-b", date: "2025-12-01", home: "A", away: "B", homeCorners: 8, awayCorners: 3 }),
    match({ id: "setup-c", date: "2025-12-02", home: "A", away: "C", homeCorners: 6, awayCorners: 4 }),
    match({ id: "setup-d", date: "2025-12-03", home: "A", away: "D", homeCorners: 2, awayCorners: 2 }),
    match({ id: "setup-a", date: "2025-12-04", home: "B", away: "A", homeCorners: 4, awayCorners: 5 }),
    match({ id: "target-1", date: "2026-01-01", home: "A", away: "B", homeCorners: 10, awayCorners: 2 }),
    match({ id: "target-2", date: "2026-01-10", home: "A", away: "C", homeCorners: 7, awayCorners: 3 }),
    match({ id: "future", date: "2026-02-10", home: "D", away: "B", homeCorners: 100, awayCorners: 1 }),
  ];

  return buildOpponentStrengthProfile({
    teams,
    matches,
    teamId: "A",
    statKey: "corners",
    scope: "TEAM_FOR",
    venue: "HOME",
    lookback: null,
    minSample: 1,
    before: new Date("2026-02-01"),
    currentOpponentId: "B",
    ...overrides,
  });
}

test("mapowanie zakresu używa przeciwnej perspektywy rywala", () => {
  assert.equal(opponentRatingScope("TEAM_FOR"), "TEAM_AGAINST");
  assert.equal(opponentRatingScope("TEAM_AGAINST"), "TEAM_FOR");
  assert.equal(opponentRatingScope("MATCH_TOTAL"), "MATCH_TOTAL");
});

test("koszyk aktualnego rywala nie korzysta z przyszłych meczów", () => {
  const result = profile();
  assert.equal(result.currentOpponent?.teamId, "B");
  assert.equal(result.currentOpponent?.sample, 2);
  assert.equal(result.currentOpponent?.bucket, 1);
});

test("korekta jest średnią różnicą do oczekiwań i nie zastępuje surowej średniej", () => {
  const result = profile();
  assert.ok(result.rawAverage !== null);
  assert.ok(result.adjustment !== null);
  assert.ok(result.leagueAverage !== null);
  assert.ok(result.adjustedAverage !== null);
  assert.equal(
    Number((result.adjustedAverage! - result.leagueAverage!).toFixed(10)),
    Number(result.adjustment!.toFixed(10)),
  );
  assert.notEqual(result.rawAverage, result.adjustedAverage);
  assert.ok(result.comparableSample > 0);
});

test("brak statystyki pozostaje brakiem i nie zwiększa próby", () => {
  const result = profile({
    matches: [
      match({ id: "one", date: "2026-01-01", home: "A", away: "B", homeCorners: null, awayCorners: 2 }),
    ],
    before: null,
    currentOpponentId: null,
  });
  assert.equal(result.sample, 0);
  assert.equal(result.rawAverage, null);
  assert.equal(result.adjustedAverage, null);
});

test("podsumowanie zachowuje cztery koszyki nawet przy pustej próbie", () => {
  const result = profile();
  assert.deepEqual(result.byBucket.map((row) => row.bucket), [1, 2, 3, 4]);
  assert.equal(result.byBucket.reduce((sum, row) => sum + row.matches, 0), result.rows.filter((row) => row.opponentBucket !== null).length);
});
