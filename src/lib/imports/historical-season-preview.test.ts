import assert from "node:assert/strict";
import test from "node:test";
import { buildHistoricalSeasonPreview } from "@/lib/imports/historical-season-preview";

test("nowy sezon historyczny otrzymuje wyłącznie kandydata do późniejszego zapisu", () => {
  const preview = buildHistoricalSeasonPreview({
    league: {
      id: "league-1",
      name: "Ekstraklasa",
      code: "PL1",
      country: "Polska",
    },
    startYear: 2024,
    name: "2024/25",
  });

  assert.equal(preview.id, "pending-season:league-1:2024");
  assert.equal(preview.seasonCandidate.leagueId, "league-1");
  assert.equal(preview.seasonCandidate.name, "2024/25");
  assert.equal(preview.seasonCandidate.active, false);
  assert.equal(preview.startsAt.toISOString(), "2024-07-01T00:00:00.000Z");
  assert.equal(preview.endsAt.toISOString(), "2025-06-30T23:59:59.000Z");
});

test("identyfikator podglądu jest stabilny dla tej samej ligi i sezonu", () => {
  const input = {
    league: {
      id: "league-1",
      name: "Premier League",
      code: "ENG1",
      country: "Anglia",
    },
    startYear: 2023,
    name: "2023/24",
  };

  assert.equal(
    buildHistoricalSeasonPreview(input).id,
    buildHistoricalSeasonPreview(input).id,
  );
});
