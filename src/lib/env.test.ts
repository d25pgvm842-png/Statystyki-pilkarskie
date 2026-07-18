import assert from "node:assert/strict";
import test from "node:test";
import { validateDeploymentEnv, validateRuntimeEnv } from "@/lib/env";

const safeSecret = "a-very-long-random-secret-value-1234567890";

test("runtime environment accepts PostgreSQL and a long secret", () => {
  const result = validateRuntimeEnv({
    DATABASE_URL: "postgresql://user:password@localhost:5432/staty",
    AUTH_SECRET: safeSecret,
  });

  assert.equal(result.AUTH_SECRET, safeSecret);
});

test("runtime environment rejects a short secret", () => {
  assert.throws(() =>
    validateRuntimeEnv({
      DATABASE_URL: "postgresql://user:password@localhost:5432/staty",
      AUTH_SECRET: "short",
    }),
  );
});

test("deployment environment rejects a local database", () => {
  assert.throws(
    () =>
      validateDeploymentEnv({
        DATABASE_URL: "postgresql://user:password@localhost:5432/staty",
        AUTH_SECRET: safeSecret,
      }),
    /lokalnej bazy/,
  );
});

test("deployment environment rejects an example secret", () => {
  assert.throws(
    () =>
      validateDeploymentEnv({
        DATABASE_URL: "postgresql://user:password@db.example.com:5432/staty",
        AUTH_SECRET: "development-secret-change-before-production",
      }),
    /wartość przykładową/,
  );
});
