import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("plan gry blokuje zasób przed oceną i mutacją", () => {
  const actions = source("./actions/play-plan-actions.ts");
  assert.match(actions, /lockTransactionResource\(tx, "daily-play-plan", planId\)/u);
  assert.match(actions, /loadDailyPlayPlanEvaluation\(tx,/u);
  assert.match(actions, /lockTransactionResource\(tx, "analysis-pick", item\.analysisPickId\)/u);
});

test("rozliczenie ręczne i automatyczne używają tej samej blokady picka", () => {
  const actions = source("./actions/analysis-journal-actions.ts");
  assert.ok((actions.match(/lockTransactionResource\(tx, "analysis-pick"/gu) ?? []).length >= 3);
  assert.match(actions, /status:\s*AnalysisPickStatus\.PLAYED/u);
  assert.match(actions, /updateMany\(/u);
});

test("ręczna edycja meczu i legacy import współdzielą blokadę meczu", () => {
  const matchActions = source("./actions/match-actions.ts");
  const importActions = source("./actions/import-actions.ts");
  assert.match(matchActions, /lockTransactionResource\(tx, "match"/u);
  assert.match(importActions, /lockTransactionResource\(tx, "match", apiExistingId\)/u);
});

test("CI uruchamia migracje i atomowe testy PostgreSQL", () => {
  const workflow = source("../../.github/workflows/ci.yml");
  assert.match(workflow, /postgres:16/u);
  assert.match(workflow, /npm run db:deploy/u);
  assert.match(workflow, /npm run test:postgres/u);
});
