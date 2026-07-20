import assert from "node:assert/strict";
import test from "node:test";
import { buildAnalysisPickFingerprint } from "@/lib/stats/analysis-journal";

test("fingerprint rozróżnia sumę gospodarza i gościa", () => {
  const home = buildAnalysisPickFingerprint({
    matchId: "m1",
    statKey: "corners",
    scope: "TEAM_FOR",
    selectedTeamId: "home",
    threshold: 4.5,
    side: "OVER",
  });
  const away = buildAnalysisPickFingerprint({
    matchId: "m1",
    statKey: "corners",
    scope: "TEAM_FOR",
    selectedTeamId: "away",
    threshold: 4.5,
    side: "OVER",
  });
  assert.notEqual(home, away);
});
