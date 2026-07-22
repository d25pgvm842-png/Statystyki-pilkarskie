import assert from "node:assert/strict";
import test from "node:test";
import { paginationHref, paginationState } from "./pagination";

test("paginacja ogranicza stronę do istniejącego zakresu", () => {
  assert.deepEqual(paginationState({ requestedPage: "99", totalItems: 120, pageSize: 50 }), {
    page: 3,
    pageSize: 50,
    totalPages: 3,
    skip: 100,
    from: 101,
    to: 120,
  });
});

test("paginacja zachowuje filtry i usuwa starą stronę", () => {
  assert.equal(
    paginationHref("/matches", { leagueId: "pl", page: "7", empty: "" }, 2),
    "/matches?leagueId=pl&page=2",
  );
  assert.equal(paginationHref("/matches", {}, 1), "/matches");
});
