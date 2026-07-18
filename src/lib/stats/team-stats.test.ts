import assert from "node:assert/strict";
import test from "node:test";
import { calculateTeamStats, splitTeamStats } from "./team-stats";

test("liczy średnią, medianę i sumę", () => {
  const result = calculateTeamStats([
    { isHome: true, stats: { homeCorners: 6, awayCorners: 4 } },
    { isHome: false, stats: { homeCorners: 8, awayCorners: 2 } },
  ]);
  const corners = result.find((item) => item.key === "corners");
  assert.equal(corners?.team.average, 4);
  assert.equal(corners?.opponent.average, 6);
  assert.equal(corners?.total.average, 10);
  assert.equal(corners?.team.median, 4);
});

test("dzieli mecze domowe i wyjazdowe", () => {
  const result = splitTeamStats([
    { isHome: true, stats: { homeFouls: 10, awayFouls: 12 } },
    { isHome: false, stats: { homeFouls: 8, awayFouls: 14 } },
  ]);
  const homeFouls = result.home.find((item) => item.key === "fouls");
  const awayFouls = result.away.find((item) => item.key === "fouls");
  assert.equal(homeFouls?.team.average, 10);
  assert.equal(awayFouls?.team.average, 14);
});
