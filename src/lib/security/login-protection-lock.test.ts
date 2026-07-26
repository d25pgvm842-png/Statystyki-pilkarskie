import assert from "node:assert/strict";
import test from "node:test";
import { lockLoginProtectionTarget } from "./login-protection-lock";

test("blokada logowania rzutuje PostgreSQL void na text", async () => {
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

  await lockLoginProtectionTarget(
    tx as never,
    "email:security-hash",
  );

  assert.match(
    sql,
    /pg_advisory_xact_lock\(hashtextextended\(\?, 0\)\)::text AS "lock"/,
  );
  assert.deepEqual(values, ["email:security-hash"]);
});

test("blokada zachowuje osobny klucz IP", async () => {
  let values: unknown[] = [];

  const tx = {
    $queryRaw: async (
      _strings: TemplateStringsArray,
      ...inputValues: unknown[]
    ) => {
      values = inputValues;
      return [{ lock: "" }];
    },
  };

  await lockLoginProtectionTarget(
    tx as never,
    "ip:security-hash",
  );

  assert.deepEqual(values, ["ip:security-hash"]);
});
