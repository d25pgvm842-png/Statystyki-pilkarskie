import assert from "node:assert/strict";
import test from "node:test";
import { preferIncoming, stableMatchStatus } from "@/lib/imports/api-update-safety";

test("brakująca wartość z API nie kasuje istniejącej statystyki", () => {
  assert.equal(preferIncoming(7, null), 7);
  assert.equal(preferIncoming(7, undefined), 7);
});

test("zero z API jest prawidłową wartością i zastępuje poprzednią", () => {
  assert.equal(preferIncoming(3, 0), 0);
});

test("nowa niepusta wartość zastępuje poprzednią", () => {
  assert.equal(preferIncoming(3, 5), 5);
});

test("mecz zakończony nie wraca do statusu zaplanowanego", () => {
  assert.equal(stableMatchStatus("FINISHED", "SCHEDULED"), "FINISHED");
  assert.equal(stableMatchStatus("FINISHED", "LIVE"), "FINISHED");
});

test("niezakończony mecz może przejść do kolejnego statusu", () => {
  assert.equal(stableMatchStatus("SCHEDULED", "LIVE"), "LIVE");
  assert.equal(stableMatchStatus("LIVE", "FINISHED"), "FINISHED");
});
