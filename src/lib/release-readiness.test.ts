import assert from "node:assert/strict";
import test from "node:test";
import { createReadinessResult } from "./release-readiness";

const NOW = new Date("2026-07-24T09:00:00.000Z");
const ENV = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
};

test("zwraca gotowość po poprawnym połączeniu z bazą", async () => {
  const result = await createReadinessResult(
    async () => undefined,
    NOW,
    ENV,
  );

  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.status, "ok");
  assert.equal(result.payload.database, "ok");
  assert.equal(result.payload.commit, "abcdef123456");
});

test("zwraca 503 bez ujawniania błędu bazy", async () => {
  const result = await createReadinessResult(
    async () => {
      throw new Error("postgresql://secret@private-host/database");
    },
    NOW,
    ENV,
  );

  assert.equal(result.statusCode, 503);
  assert.equal(result.payload.status, "degraded");
  assert.equal(result.payload.database, "error");
  assert.equal(
    JSON.stringify(result.payload).includes("private-host"),
    false,
  );
});
