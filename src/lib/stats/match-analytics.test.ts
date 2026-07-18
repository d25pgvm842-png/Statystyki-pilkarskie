import assert from "node:assert/strict";
import test from "node:test";
import { calculateMatchSummary, calculateRefereeSummary } from "./match-analytics";

test("liczy średnie sum meczowych wyłącznie z kompletnych par", () => {
  const summary = calculateMatchSummary([
    { stats: { homeCorners: 6, awayCorners: 4, homeFouls: 10, awayFouls: 12 } },
    { stats: { homeCorners: 8, awayCorners: 3, homeFouls: 9, awayFouls: null } },
    { stats: null },
  ]);

  const corners = summary.metrics.find((metric) => metric.key === "corners");
  const fouls = summary.metrics.find((metric) => metric.key === "fouls");

  assert.equal(summary.matches, 3);
  assert.equal(summary.matchesWithStats, 2);
  assert.equal(corners?.count, 2);
  assert.equal(corners?.average, 10.5);
  assert.equal(fouls?.count, 1);
  assert.equal(fouls?.average, 22);
});

test("liczy skuteczność linii kartek sędziego", () => {
  const summary = calculateRefereeSummary([
    { stats: { homeYellowCards: 2, awayYellowCards: 2 } },
    { stats: { homeYellowCards: 4, awayYellowCards: 2 } },
    { stats: { homeYellowCards: 1, awayYellowCards: 2 } },
  ]);

  assert.ok(Math.abs((summary.yellowCardLines[0].hitRate ?? 0) - 200 / 3) < 1e-9);
  assert.ok(Math.abs((summary.yellowCardLines[1].hitRate ?? 0) - 100 / 3) < 1e-9);
  assert.ok(Math.abs((summary.yellowCardLines[2].hitRate ?? 0) - 100 / 3) < 1e-9);
});
