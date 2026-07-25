import assert from "node:assert/strict";
import test from "node:test";
import {
  filterReferenceSeasonsByActiveLeague,
  filterReferenceSeasonsByLeague,
} from "./reference-data-filters";

const seasons = [
  {
    id: "season-a",
    leagueId: "league-a",
    league: { active: true },
  },
  {
    id: "season-b",
    leagueId: "league-b",
    league: { active: false },
  },
  {
    id: "season-c",
    leagueId: "league-a",
    league: { active: true },
  },
] as const;

test("filtruje sezony po lidze bez zmiany kolejności", () => {
  assert.deepEqual(
    filterReferenceSeasonsByLeague(seasons, "league-a").map(
      (season) => season.id,
    ),
    ["season-a", "season-c"],
  );
});

test("bez ligi zwraca pełną listę jako nową tablicę", () => {
  const result = filterReferenceSeasonsByLeague(seasons, "");

  assert.deepEqual(result, seasons);
  assert.notEqual(result, seasons);
});

test("odrzuca sezony nieaktywnych lig", () => {
  assert.deepEqual(
    filterReferenceSeasonsByActiveLeague(seasons).map(
      (season) => season.id,
    ),
    ["season-a", "season-c"],
  );
});
