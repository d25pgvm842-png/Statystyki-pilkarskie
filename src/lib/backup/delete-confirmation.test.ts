import assert from "node:assert/strict";
import test from "node:test";
import { DELETE_MATCH_CONFIRMATION, isDeleteMatchConfirmationValid } from "./delete-confirmation";

test("wymaga pełnej frazy potwierdzającej usunięcie", () => {
  assert.equal(isDeleteMatchConfirmationValid(DELETE_MATCH_CONFIRMATION), true);
  assert.equal(isDeleteMatchConfirmationValid("  usun mecz  "), true);
  assert.equal(isDeleteMatchConfirmationValid("usun"), false);
  assert.equal(isDeleteMatchConfirmationValid(""), false);
});
