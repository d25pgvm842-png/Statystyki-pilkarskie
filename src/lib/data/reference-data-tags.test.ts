import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERENCE_DATA_CACHE_TAGS,
  referenceDataTagsForMutation,
  type ReferenceDataMutation,
} from "./reference-data-tags";

test("zmiana widocznosci ligi odswieza ligi i sezony", () => {
  assert.deepEqual(
    referenceDataTagsForMutation("league-visibility-changed"),
    [
      REFERENCE_DATA_CACHE_TAGS.leagues,
      REFERENCE_DATA_CACHE_TAGS.seasons,
    ],
  );
});

test("pozostale mutacje odswiezaja tylko swoj katalog", () => {
  const cases: Array<[ReferenceDataMutation, string]> = [
    ["league-created", REFERENCE_DATA_CACHE_TAGS.leagues],
    ["season-changed", REFERENCE_DATA_CACHE_TAGS.seasons],
    ["team-changed", REFERENCE_DATA_CACHE_TAGS.teams],
    ["referee-changed", REFERENCE_DATA_CACHE_TAGS.referees],
  ];

  for (const [mutation, expectedTag] of cases) {
    assert.deepEqual(referenceDataTagsForMutation(mutation), [expectedTag]);
  }
});

test("zadna mutacja nie zwraca duplikatow tagow", () => {
  const mutations: ReferenceDataMutation[] = [
    "league-created",
    "league-visibility-changed",
    "season-changed",
    "team-changed",
    "referee-changed",
  ];

  for (const mutation of mutations) {
    const tags = referenceDataTagsForMutation(mutation);
    assert.equal(new Set(tags).size, tags.length);
  }
});
