import assert from "node:assert/strict";
import test from "node:test";
import { inspectRawQueries } from "./raw-query-safety";

test("akceptuje zwykłe parametryzowane queryRaw", () => {
  const result = inspectRawQueries(
    "ready.ts",
    "await prisma.$queryRaw\`SELECT 1\`;",
  );

  assert.equal(result.inventory.length, 1);
  assert.equal(result.violations.length, 0);
});

test("akceptuje blokadę PostgreSQL rzutowaną do text", () => {
  const result = inspectRawQueries(
    "lock.ts",
    "await tx.$queryRaw<Array<{ lock: string }>>\`"
      + "SELECT pg_advisory_xact_lock(hashtextextended(\${key}, 0))::text AS \"lock\""
      + "\`;",
  );

  assert.equal(result.inventory.length, 1);
  assert.equal(result.violations.length, 0);
});

test("odrzuca blokadę PostgreSQL zwracającą void", () => {
  const result = inspectRawQueries(
    "broken-lock.ts",
    "await tx.$queryRaw\`SELECT pg_advisory_xact_lock(hashtextextended(\${key}, 0))\`;",
  );

  assert.equal(result.violations.length, 1);
  assert.equal(
    result.violations[0]?.rule,
    "POSTGRES_VOID_LOCK_MUST_BE_CAST",
  );
});

test("odrzuca queryRawUnsafe i executeRawUnsafe", () => {
  const source = [
    'await prisma.$queryRawUnsafe("SELECT " + value);',
    'await prisma.$executeRawUnsafe("DELETE " + value);',
  ].join("\n");
  const result = inspectRawQueries("unsafe.ts", source);

  assert.equal(result.violations.length, 2);
  assert.deepEqual(
    result.violations.map((item) => item.rule),
    ["RAW_UNSAFE_FORBIDDEN", "RAW_UNSAFE_FORBIDDEN"],
  );
});

test("nie traktuje nazw API w komentarzach jako wywołań", () => {
  const result = inspectRawQueries(
    "comments.ts",
    "// prisma.$queryRawUnsafe('SELECT 1')",
  );

  assert.equal(result.inventory.length, 0);
  assert.equal(result.violations.length, 0);
});
