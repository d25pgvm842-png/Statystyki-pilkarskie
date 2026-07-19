import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveUniqueTeamIdentity,
  scoreTeamIdentity,
} from "@/lib/teams/team-identity";

test("łączy niemiecką i angielską nazwę Bayernu", () => {
  const result = scoreTeamIdentity(
    { id: "api", name: "FC Bayern München", shortName: "Bayern" },
    { id: "db", name: "Bayern Munich" },
  );
  assert.equal(result.score, 100);
});

test("usuwa oznaczenia klubowe i rok założenia", () => {
  assert.ok(scoreTeamIdentity(
    { id: "api", name: "1. FC Union Berlin" },
    { id: "db", name: "Union Berlin" },
  ).score >= 90);
  assert.ok(scoreTeamIdentity(
    { id: "api", name: "1. FSV Mainz 05" },
    { id: "db", name: "Mainz" },
  ).score >= 90);
});

test("rozpoznaje skróconą nazwę Borussii Mönchengladbach", () => {
  assert.equal(scoreTeamIdentity(
    { id: "api", name: "Borussia Mönchengladbach" },
    { id: "db", name: "M'gladbach" },
  ).score, 100);
});

test("nie łączy Manchesteru City z Manchesterem United", () => {
  assert.equal(scoreTeamIdentity(
    { id: "city", name: "Manchester City FC" },
    { id: "united", name: "Manchester United FC" },
  ).score, 0);
});

test("przy remisie wybiera starszą drużynę z historią sezonów", () => {
  const result = resolveUniqueTeamIdentity(
    { id: "api", name: "FC Bayern München" },
    [
      { id: "new", name: "FC Bayern München", historicalSeasonCount: 1, createdAt: "2026-07-19" },
      { id: "old", name: "Bayern Munich", historicalSeasonCount: 4, createdAt: "2025-01-01" },
    ],
  );
  assert.equal(result.match?.team.id, "old");
  assert.equal(result.ambiguous.length, 0);
});

test("zatrzymuje dopasowanie dwóch równie mocnych kandydatów", () => {
  const result = resolveUniqueTeamIdentity(
    { id: "api", name: "Union Berlin" },
    [
      { id: "a", name: "1. FC Union Berlin", historicalSeasonCount: 1 },
      { id: "b", name: "FC Union Berlin", historicalSeasonCount: 1 },
    ],
  );
  assert.equal(result.match, null);
  assert.equal(result.ambiguous.length, 2);
});
