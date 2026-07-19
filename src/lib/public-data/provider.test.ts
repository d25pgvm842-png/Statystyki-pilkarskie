import assert from "node:assert/strict";
import test from "node:test";
import { MatchStatus } from "@/generated/prisma/enums";
import {
  footballDataOrgCompetitionCode,
  footballDataUkUrl,
  normalizePublicStatus,
  openFootballUrl,
  parseFootballDataKickoff,
  parsePublicRound,
  seasonFolder,
  seasonLabel,
} from "@/lib/public-data/provider";

test("mapuje ligi football-data.org", () => {
  assert.equal(footballDataOrgCompetitionCode("ENG1"), "PL");
  assert.equal(footballDataOrgCompetitionCode("GER1"), "BL1");
  assert.equal(footballDataOrgCompetitionCode("PL1"), null);
});

test("buduje adresy darmowych źródeł", () => {
  assert.equal(
    footballDataUkUrl("ENG1", 2025),
    "https://www.football-data.co.uk/mmz4281/2526/E0.csv",
  );
  assert.equal(
    footballDataUkUrl("PL1", 2025),
    "https://www.football-data.co.uk/new/POL.csv",
  );
  assert.equal(
    openFootballUrl("ESP1", 2026),
    "https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/es.1.json",
  );
});

test("formatuje sezon", () => {
  assert.equal(seasonFolder(2026), "2026-27");
  assert.equal(seasonLabel(2026), "2026/27");
});

test("parsuje kolejkę", () => {
  assert.equal(parsePublicRound("Matchday 12"), 12);
  assert.equal(parsePublicRound(3), 3);
  assert.equal(parsePublicRound(null), null);
});

test("normalizuje status meczu", () => {
  assert.equal(normalizePublicStatus("IN_PLAY", false), MatchStatus.LIVE);
  assert.equal(normalizePublicStatus("SUSPENDED", false), MatchStatus.POSTPONED);
  assert.equal(normalizePublicStatus("", true), MatchStatus.FINISHED);
  assert.equal(normalizePublicStatus("", false), MatchStatus.SCHEDULED);
});

test("parsuje datę Football-Data.co.uk", () => {
  assert.equal(
    parseFootballDataKickoff("15/08/25", "20:00")?.toISOString(),
    "2025-08-15T20:00:00.000Z",
  );
  assert.equal(
    parseFootballDataKickoff("15/08/2025", "")?.toISOString(),
    "2025-08-15T12:00:00.000Z",
  );
  assert.equal(parseFootballDataKickoff("31/02/25", "20:00"), null);
});
