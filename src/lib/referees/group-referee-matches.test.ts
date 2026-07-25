import assert from "node:assert/strict";
import test from "node:test";
import { groupRefereeMatches } from "./group-referee-matches";

const rows = [
  { id: "a-3", refereeId: "a" },
  { id: "b-2", refereeId: "b" },
  { id: "a-2", refereeId: "a" },
  { id: "a-1", refereeId: "a" },
  { id: "b-1", refereeId: "b" },
  { id: "missing", refereeId: null },
];

test("grupuje mecze według sędziego i zachowuje kolejność wejściową", () => {
  const grouped = groupRefereeMatches(rows, null);

  assert.deepEqual(
    grouped.get("a")?.map((row) => row.id),
    ["a-3", "a-2", "a-1"],
  );
  assert.deepEqual(
    grouped.get("b")?.map((row) => row.id),
    ["b-2", "b-1"],
  );
  assert.equal(grouped.has(""), false);
});

test("ogranicza próbę osobno dla każdego sędziego", () => {
  const grouped = groupRefereeMatches(rows, 2);

  assert.deepEqual(
    grouped.get("a")?.map((row) => row.id),
    ["a-3", "a-2"],
  );
  assert.deepEqual(
    grouped.get("b")?.map((row) => row.id),
    ["b-2", "b-1"],
  );
});
