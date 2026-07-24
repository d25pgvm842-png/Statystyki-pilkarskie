import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION, createHealthPayload } from "./release-health";

test("wersja wydania ma poprawny format", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
});

test("buduje stabilny publiczny kontrakt health", () => {
  const payload = createHealthPayload(
    new Date("2026-07-23T08:15:30.000Z"),
    {
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "1234567890abcdef",
    },
  );

  assert.deepEqual(payload, {
    status: "ok",
    application: "Staty piłkarskie",
    version: APP_VERSION,
    environment: "production",
    commit: "1234567890ab",
    timestamp: "2026-07-23T08:15:30.000Z",
  });
});

test("nie ujawnia brakujących metadanych wdrożenia", () => {
  const payload = createHealthPayload(
    new Date("2026-07-23T08:15:30.000Z"),
    {},
  );

  assert.equal(payload.environment, "unknown");
  assert.equal(payload.commit, null);
});

test("używa NODE_ENV jako bezpiecznego fallbacku", () => {
  const payload = createHealthPayload(
    new Date("2026-07-23T08:15:30.000Z"),
    { NODE_ENV: "test" },
  );

  assert.equal(payload.environment, "test");
});
