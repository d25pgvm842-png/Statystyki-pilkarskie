import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCustomLineForMatch,
  buildMarketProjections,
  summarizeForm,
  summarizeReferee,
  type AnalysisMatch,
} from "@/lib/stats/match-analysis";

function match(input: {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number | null;
  awayScore?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeYellowCards?: number | null;
  awayYellowCards?: number | null;
  homeRedCards?: number | null;
  awayRedCards?: number | null;
  homeFouls?: number | null;
  awayFouls?: number | null;
}): AnalysisMatch {
  return {
    id: input.id,
    kickoffAt: new Date(`2025-08-${String(Number(input.id.replace(/\D/g, "")) + 10).padStart(2, "0")}T15:00:00.000Z`),
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeScore: input.homeScore ?? 1,
    awayScore: input.awayScore ?? 0,
    stats: {
      homeCorners: input.homeCorners === undefined ? 5 : input.homeCorners,
      awayCorners: input.awayCorners === undefined ? 4 : input.awayCorners,
      homeYellowCards: input.homeYellowCards === undefined ? 2 : input.homeYellowCards,
      awayYellowCards: input.awayYellowCards === undefined ? 1 : input.awayYellowCards,
      homeRedCards: input.homeRedCards === undefined ? 0 : input.homeRedCards,
      awayRedCards: input.awayRedCards === undefined ? 0 : input.awayRedCards,
      homeFouls: input.homeFouls === undefined ? 10 : input.homeFouls,
      awayFouls: input.awayFouls === undefined ? 11 : input.awayFouls,
      homeShotsOnTarget: 5,
      awayShotsOnTarget: 3,
      homeShots: 12,
      awayShots: 9,
      homeOffsides: 1,
      awayOffsides: 2,
    },
  };
}

test("projekcja łączy produkcję gospodarza z wartościami oddawanymi przez gościa", () => {
  const homeMatches = [
    match({ id: "1", homeTeamId: "H", awayTeamId: "X", homeCorners: 6, awayCorners: 4 }),
    match({ id: "2", homeTeamId: "H", awayTeamId: "Y", homeCorners: 8, awayCorners: 2 }),
  ];
  const awayMatches = [
    match({ id: "3", homeTeamId: "Z", awayTeamId: "A", homeCorners: 5, awayCorners: 3 }),
    match({ id: "4", homeTeamId: "W", awayTeamId: "A", homeCorners: 7, awayCorners: 5 }),
  ];
  const corners = buildMarketProjections({
    homeMatches,
    awayMatches,
    homeTeamId: "H",
    awayTeamId: "A",
  }).find((item) => item.key === "corners");

  assert.equal(corners?.homeFor, 7);
  assert.equal(corners?.awayAgainst, 6);
  assert.equal(corners?.projectedHome, 6.5);
  assert.equal(corners?.projectedAway, 3.5);
  assert.equal(corners?.projectedTotal, 10);
  assert.equal(corners?.lines.find((line) => line.threshold === 9.5)?.overRate, 75);
});

test("forma poprawnie liczy bilans i punkty niezależnie od roli drużyny", () => {
  const matches = [
    match({ id: "1", homeTeamId: "T", awayTeamId: "X", homeScore: 2, awayScore: 0 }),
    match({ id: "2", homeTeamId: "Y", awayTeamId: "T", homeScore: 1, awayScore: 1 }),
    match({ id: "3", homeTeamId: "T", awayTeamId: "Z", homeScore: 0, awayScore: 3 }),
  ];
  const summary = summarizeForm(matches, "T");
  assert.deepEqual(summary, {
    count: 3,
    wins: 1,
    draws: 1,
    losses: 1,
    points: 4,
    pointsPerMatch: 4 / 3,
    goalsFor: 3,
    goalsAgainst: 4,
  });
});

test("brak statystyki nie jest zamieniany na zero w projekcji", () => {
  const projections = buildMarketProjections({
    homeMatches: [match({ id: "1", homeTeamId: "H", awayTeamId: "X", homeCorners: null })],
    awayMatches: [match({ id: "2", homeTeamId: "Y", awayTeamId: "A", awayCorners: null })],
    homeTeamId: "H",
    awayTeamId: "A",
  });
  const corners = projections.find((item) => item.key === "corners");
  assert.equal(corners?.projectedHome, 5);
  assert.equal(corners?.projectedAway, 4);
  assert.equal(corners?.homeSample, 0);
  assert.equal(corners?.awaySample, 0);
});

test("profil sędziego liczy średnie tylko z kompletnych par wartości", () => {
  const matches = [
    match({ id: "1", homeTeamId: "A", awayTeamId: "B", homeYellowCards: 2, awayYellowCards: 4, homeFouls: 10, awayFouls: 12 }),
    match({ id: "2", homeTeamId: "C", awayTeamId: "D", homeYellowCards: 1, awayYellowCards: 3, homeFouls: 8, awayFouls: 10 }),
  ];
  const summary = summarizeReferee(matches);
  assert.equal(summary.yellowCards, 5);
  assert.equal(summary.cards, 5);
  assert.equal(summary.fouls, 20);
});

test("własna linia drużynowa zwraca osobne pokrycie gospodarza i gościa", () => {
  const result = analyzeCustomLineForMatch({
    statKey: "corners",
    scope: "TEAM_FOR",
    threshold: 4.5,
    homeMatches: [
      match({ id: "1", homeTeamId: "H", awayTeamId: "X", homeCorners: 6 }),
      match({ id: "2", homeTeamId: "H", awayTeamId: "Y", homeCorners: 4 }),
    ],
    awayMatches: [
      match({ id: "3", homeTeamId: "Z", awayTeamId: "A", awayCorners: 5 }),
      match({ id: "4", homeTeamId: "W", awayTeamId: "A", awayCorners: 3 }),
    ],
    homeTeamId: "H",
    awayTeamId: "A",
  });
  assert.equal(result.home?.overRate, 50);
  assert.equal(result.away?.overRate, 50);
  assert.equal(result.combined, null);
});
