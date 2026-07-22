import assert from "node:assert/strict";
import test from "node:test";
import {
  shiftWarsawDateKey,
  warsawDateKey,
  warsawDayBounds,
  warsawDayBoundsFromKey,
} from "./date-warsaw-day";

test("wyznacza dobę warszawską latem", () => {
  const bounds = warsawDayBounds(new Date("2026-07-22T10:00:00.000Z"));
  assert.equal(bounds.key, "2026-07-22");
  assert.equal(bounds.start.toISOString(), "2026-07-21T22:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-07-22T22:00:00.000Z");
});

test("wyznacza dobę warszawską zimą", () => {
  const bounds = warsawDayBounds(new Date("2026-01-10T10:00:00.000Z"));
  assert.equal(bounds.start.toISOString(), "2026-01-09T23:00:00.000Z");
  assert.equal(bounds.end.toISOString(), "2026-01-10T23:00:00.000Z");
});

test("klucz daty nie zależy od strefy procesu Node", () => {
  assert.equal(warsawDateKey(new Date("2026-07-21T23:30:00.000Z")), "2026-07-22");
});

test("filtr daty obejmuje pełną dobę warszawską", () => {
  const bounds = warsawDayBoundsFromKey("2026-07-22");
  assert.equal(bounds?.start.toISOString(), "2026-07-21T22:00:00.000Z");
  assert.equal(bounds?.end.toISOString(), "2026-07-22T22:00:00.000Z");
});

test("przesuwa klucz daty po dniach kalendarzowych", () => {
  assert.equal(shiftWarsawDateKey("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftWarsawDateKey("2026-12-31", 1), "2027-01-01");
});

test("odrzuca nieistniejącą datę", () => {
  assert.equal(warsawDayBoundsFromKey("2026-02-30"), null);
});
