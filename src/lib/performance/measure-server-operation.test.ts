import assert from "node:assert/strict";
import test from "node:test";
import {
  isSlowServerOperation,
  measureServerOperation,
  SLOW_SERVER_OPERATION_MS,
} from "./measure-server-operation";

test("oznacza operację jako wolną od ustalonego progu", () => {
  assert.equal(isSlowServerOperation(SLOW_SERVER_OPERATION_MS - 1), false);
  assert.equal(isSlowServerOperation(SLOW_SERVER_OPERATION_MS), true);
  assert.equal(isSlowServerOperation(Number.NaN), false);
});

test("zwraca wynik mierzonej operacji", async () => {
  const result = await measureServerOperation(
    "test-operation",
    async () => 42,
    Number.POSITIVE_INFINITY,
  );

  assert.equal(result, 42);
});
