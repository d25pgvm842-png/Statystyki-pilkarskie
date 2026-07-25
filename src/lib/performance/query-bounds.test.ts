import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

test("analiza i warsztat korzystają ze wspólnego zestawu sezonu", () => {
  const analysis = source("src/lib/data/match-analysis.ts");
  const workshop = source("src/lib/data/market-workshop.ts");
  const opponentStrength = source(
    "src/lib/data/opponent-strength.ts",
  );

  assert.match(analysis, /loadSeasonAnalysisDataset/);
  assert.match(workshop, /loadSeasonAnalysisDataset/);
  assert.match(opponentStrength, /loadSeasonAnalysisDataset/);
  assert.doesNotMatch(workshop, /prisma\.match\.findMany/);
  assert.doesNotMatch(opponentStrength, /prisma\.match\.findMany/);
});

test("trendy ograniczają liczbę meczów już w zapytaniu", () => {
  const trends = source(
    "src/app/(dashboard)/trends/page.tsx",
  );

  assert.match(
    trends,
    /\.\.\.\(limit \? \{ take: limit \} : \{\}\)/,
  );
});

test("schema ma indeksy pod najczęstsze zapytania", () => {
  const schema = source("prisma/schema.prisma");

  assert.match(
    schema,
    /@@index\(\[seasonId, status, kickoffAt\]\)/,
  );
  assert.match(
    schema,
    /@@index\(\[refereeId, status, kickoffAt\]\)/,
  );
  assert.match(
    schema,
    /@@index\(\[entityType, entityId, createdAt\]\)/,
  );
  assert.match(
    schema,
    /@@index\(\[auditLogId, fieldName\]\)/,
  );
});
