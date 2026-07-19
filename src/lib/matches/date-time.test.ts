import assert from "node:assert/strict";
import test from "node:test";
import { kickoffInputValue } from "./date-time";

test("nie dodaje przesunięcia strefy do wartości datetime-local", () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = "Europe/Warsaw";

  try {
    assert.equal(kickoffInputValue("2026-07-27T18:00:00.000Z"), "2026-07-27T18:00");
  } finally {
    process.env.TZ = previousTimeZone;
  }
});

test("zwraca pustą wartość dla braku lub błędnej daty", () => {
  assert.equal(kickoffInputValue(), "");
  assert.equal(kickoffInputValue("nie-data"), "");
});
