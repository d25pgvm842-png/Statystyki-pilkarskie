import assert from "node:assert/strict";
import test from "node:test";
import {
  historicalTeamAmbiguities,
  isAllowedHistoricalMappingTarget,
} from "./backfill-mapping-policy";

test("odczytuje kandydatów mapowania z zapisanego wiersza", () => {
  const result = historicalTeamAmbiguities({
    provider: "API_FOOTBALL",
    seasonId: "season-1",
    homeTeamCandidate: {
      externalId: "123",
      name: "Klub z API",
      shortName: null,
      country: "Poland",
      ambiguousMatches: [
        { id: "team-a", name: "Klub A", score: 98 },
        { id: "team-b", name: "Klub B", score: 97 },
      ],
    },
  });

  assert.equal(result.length, 1);
  assert.equal(result[0]?.side, "home");
  assert.equal(result[0]?.externalId, "123");
  assert.equal(result[0]?.candidates.length, 2);
  assert.equal(
    isAllowedHistoricalMappingTarget(result[0]!, "team-b"),
    true,
  );
  assert.equal(
    isAllowedHistoricalMappingTarget(result[0]!, "team-x"),
    false,
  );
});

test("ignoruje niepełny lub pozbawiony kandydatów wiersz", () => {
  assert.deepEqual(historicalTeamAmbiguities(null), []);
  assert.deepEqual(
    historicalTeamAmbiguities({
      provider: "API_FOOTBALL",
      seasonId: "season-1",
      homeTeamCandidate: {
        externalId: "123",
        name: "Klub",
        ambiguousMatches: [],
      },
    }),
    [],
  );
});
