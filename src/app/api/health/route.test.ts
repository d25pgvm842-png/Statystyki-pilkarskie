import assert from "node:assert/strict";
import test from "node:test";
import { APP_VERSION } from "@/lib/release-health";
import { GET, HEAD } from "./route";

test("GET health zwraca stabilny kontrakt bez cache", async () => {
  const response = GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(payload.status, "ok");
  assert.equal(payload.version, APP_VERSION);
  assert.equal(typeof payload.timestamp, "string");
});

test("HEAD health zwraca 200 bez treści", async () => {
  const response = HEAD();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(await response.text(), "");
});
