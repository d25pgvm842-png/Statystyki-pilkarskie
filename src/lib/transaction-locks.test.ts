import assert from "node:assert/strict";
import test from "node:test";
import { transactionLockKey } from "./transaction-locks";

test("transaction locks are namespaced and resource-specific", () => {
  assert.equal(
    transactionLockKey("daily-play-plan", "plan-1"),
    "staty-pilkarskie:daily-play-plan:plan-1",
  );
  assert.notEqual(
    transactionLockKey("daily-play-plan", "same-id"),
    transactionLockKey("analysis-pick", "same-id"),
  );
});
