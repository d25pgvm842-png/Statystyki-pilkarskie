import assert from "node:assert/strict";
import test from "node:test";
import { canAdminister, canWrite, hasCapability } from "@/lib/permissions";

test("VIEWER ma wyłącznie odczyt", () => {
  assert.equal(hasCapability("VIEWER", "READ"), true);
  assert.equal(canWrite("VIEWER"), false);
  assert.equal(canAdminister("VIEWER"), false);
});

test("ANALYST może czytać i zapisywać bez administracji", () => {
  assert.equal(hasCapability("ANALYST", "READ"), true);
  assert.equal(canWrite("ANALYST"), true);
  assert.equal(canAdminister("ANALYST"), false);
});

test("ADMIN ma wszystkie możliwości", () => {
  assert.equal(hasCapability("ADMIN", "READ"), true);
  assert.equal(canWrite("ADMIN"), true);
  assert.equal(canAdminister("ADMIN"), true);
});

test("nieznana rola nie otrzymuje żadnych możliwości", () => {
  assert.equal(hasCapability("OWNER", "READ"), false);
  assert.equal(canWrite(""), false);
});
