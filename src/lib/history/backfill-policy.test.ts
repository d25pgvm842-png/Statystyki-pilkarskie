import assert from "node:assert/strict";
import test from "node:test";
import {
  batchIdsUnavailable,
  finishedFixtureIds,
  historicalCoverage,
  historicalDetailSelection,
  historicalRequestDelay,
  historicalSeasonName,
  nextFixtureChunk,
  percentage,
} from "./backfill-policy";

test("nazwa sezonu używa roku startowego API-Football", () => {
  assert.equal(historicalSeasonName(2023), "2023/24");
  assert.equal(historicalSeasonName(2025), "2025/26");
});

test("plan zawiera tylko zakończone mecze i usuwa duplikaty statusów", () => {
  const ids = finishedFixtureIds([
    { fixture: { id: 4, status: { short: "NS" } } },
    { fixture: { id: 3, status: { short: "PEN" } } },
    { fixture: { id: 1, status: { short: "FT" } } },
    { fixture: { id: 2, status: { short: "AET" } } },
    { fixture: { id: 5, status: { short: "CANC" } } },
  ]);

  assert.deepEqual(ids, [1, 2, 3]);
});

test("paczka API nigdy nie przekracza 20 identyfikatorów", () => {
  const ids = Array.from({ length: 45 }, (_, index) => index + 1);
  assert.equal(nextFixtureChunk(ids, 0, 100).length, 20);
  assert.deepEqual(nextFixtureChunk(ids, 40), [41, 42, 43, 44, 45]);
});

test("pokrycie wymaga kompletu gospodarza i gościa", () => {
  const empty = {
    homeCorners: null,
    awayCorners: null,
    homeYellowCards: null,
    awayYellowCards: null,
    homeRedCards: null,
    awayRedCards: null,
    homeShotsOnTarget: null,
    awayShotsOnTarget: null,
    homeShots: null,
    awayShots: null,
    homeFouls: null,
    awayFouls: null,
    homeOffsides: null,
    awayOffsides: null,
  };

  const coverage = historicalCoverage([
    {
      ...empty,
      homeCorners: 4,
      awayCorners: 5,
      homeFouls: 9,
      awayFouls: 11,
    },
    {
      ...empty,
      homeCorners: 6,
      awayCorners: null,
    },
  ]);

  assert.deepEqual(coverage, {
    corners: 1,
    cards: 0,
    shots: 0,
    fouls: 1,
    offsides: 0,
  });
  assert.equal(percentage(1, 2), 50);
});


test("rozpoznaje blokadę parametru ids na planie Free", () => {
  assert.equal(
    batchIdsUnavailable("Free plans do not have access to the Ids parameter."),
    true,
  );
  assert.equal(batchIdsUnavailable("Rate limit exceeded"), false);
});

test("tryb Free wybiera jeden fixture, a płatny maksymalnie dwadzieścia", () => {
  const ids = Array.from({ length: 30 }, (_, index) => index + 1);

  assert.deepEqual(
    historicalDetailSelection(ids, 4, "SINGLE_ID"),
    [5],
  );
  assert.equal(
    historicalDetailSelection(ids, 4, "BATCH_IDS").length,
    20,
  );
});

test("tryb Free zachowuje limit dziesięciu zapytań na minutę", () => {
  assert.equal(historicalRequestDelay("SINGLE_ID", 1), 6500);
  assert.equal(historicalRequestDelay("SINGLE_ID", 0), 250);
  assert.equal(historicalRequestDelay("BATCH_IDS", 1), 250);
});
