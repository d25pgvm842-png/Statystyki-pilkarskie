import assert from "node:assert/strict";
import test from "node:test";
import {
  DATABASE_POOL_LIMITS,
  databasePoolConfig,
} from "./database-pool";

test("ogranicza pulę połączeń dla środowiska serverless", () => {
  const config = databasePoolConfig(
    "postgresql://user:password@example.com:5432/database",
  );

  assert.equal(config.max, 3);
  assert.equal(
    config.connectionTimeoutMillis,
    DATABASE_POOL_LIMITS.connectionTimeoutMillis,
  );
  assert.equal(
    config.idleTimeoutMillis,
    DATABASE_POOL_LIMITS.idleTimeoutMillis,
  );
});

test("żadne zapytanie ani blokada nie mogą wisieć bez końca", () => {
  const config = databasePoolConfig(
    "postgresql://user:password@example.com:5432/database",
  );

  assert.equal(config.statement_timeout, 12_000);
  assert.equal(config.query_timeout, 15_000);
  assert.equal(config.lock_timeout, 5_000);
  assert.equal(config.idle_in_transaction_session_timeout, 10_000);
  assert.equal(config.keepAlive, true);
  assert.equal(config.application_name, "staty-pilkarskie");
});
