import assert from "node:assert/strict";
import test from "node:test";
import { normalizeLookup, normalizeStatus, parseCsv, parseKickoffDate, parseNullableInteger } from "./csv";

test("wykrywa separator i mapuje nagłówki Football-Data", () => {
  const parsed = parseCsv("Date;Time;HomeTeam;AwayTeam;FTHG;FTAG;HC;AC;HST;AST\n2026-08-01;18:00;Legia;Lech;2;1;6;4;7;3");
  assert.equal(parsed.delimiter, ";");
  assert.equal(parsed.records[0].kickoff_at, "2026-08-01 18:00");
  assert.equal(parsed.records[0].home_team, "Legia");
  assert.equal(parsed.records[0].away_team, "Lech");
  assert.equal(parsed.records[0].home_score, "2");
  assert.equal(parsed.records[0].home_corners, "6");
  assert.equal(parsed.records[0].away_shots_on_target, "3");
});

test("obsługuje przecinki oraz pola w cudzysłowach", () => {
  const parsed = parseCsv('kickoff_at,home_team,away_team,note\n2026-08-01T18:00,"Manchester City","Manchester United","Derby, kolejka 1"');
  assert.equal(parsed.records[0].home_team, "Manchester City");
  assert.equal(parsed.records[0].note, "Derby, kolejka 1");
});

test("normalizuje polskie nazwy i wartości", () => {
  assert.equal(normalizeLookup(" Jagiellonia Białystok "), "jagiellonia bialystok");
  assert.equal(parseNullableInteger("12"), 12);
  assert.equal(parseNullableInteger(""), null);
  assert.ok(Number.isNaN(parseNullableInteger("-1")));
  assert.equal(normalizeStatus("Zakończony", false), "FINISHED");
  assert.equal(normalizeStatus("", true), "FINISHED");
});


test("obsługuje europejski format daty Football-Data", () => {
  const date = parseKickoffDate("18/07/2026 20:30");
  assert.ok(date);
  assert.equal(date.getFullYear(), 2026);
  assert.equal(date.getMonth(), 6);
  assert.equal(date.getDate(), 18);
  assert.equal(date.getHours(), 20);
  assert.equal(date.getMinutes(), 30);
});
