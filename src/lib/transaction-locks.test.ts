import assert from "node:assert/strict";
import test from "node:test";
import {
  lockTransactionResource,
  transactionLockKey,
} from "./transaction-locks";

test("buduje stabilny klucz blokady meczu", () => {
  assert.equal(
    transactionLockKey("match", "match-1"),
    "staty-pilkarskie:match:match-1",
  );
});

test("rzutuje wynik blokady PostgreSQL na typ obsługiwany przez Prisma", async () => {
  let sql = "";
  let values: unknown[] = [];

  const tx = {
    $queryRaw: async (
      strings: TemplateStringsArray,
      ...inputValues: unknown[]
    ) => {
      sql = strings.join("?");
      values = inputValues;
      return [{ lock: "" }];
    },
  };

  await lockTransactionResource(tx as never, "match", "match-1");

  assert.match(
    sql,
    /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)::text AS "lock"/,
  );
  assert.deepEqual(values, ["staty-pilkarskie:match:match-1"]);
});
