import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const writeActionFiles = [
  "analysis-journal-actions.ts",
  "custom-line-actions.ts",
  "daily-recommendation-actions.ts",
  "import-actions.ts",
  "market-workshop-actions.ts",
  "match-analysis-actions.ts",
  "play-plan-actions.ts",
  "strategy-forward-actions.ts",
  "strategy-lab-actions.ts",
  "strategy-monitoring-actions.ts",
];

const adminActionFiles = [
  "api-sync-actions.ts",
  "catalog-actions.ts",
  "public-data-actions.ts",
  "team-duplicate-actions.ts",
];

function actionSource(file: string) {
  return readFileSync(new URL(`./actions/${file}`, import.meta.url), "utf8");
}

test("każdy moduł mutacji analitycznych wymaga WRITE", () => {
  for (const file of writeActionFiles) {
    assert.match(actionSource(file), /requireWriteUser/iu, file);
  }
});

test("każdy moduł administracyjny wymaga ADMIN", () => {
  for (const file of adminActionFiles) {
    assert.match(actionSource(file), /requireAdminUser/iu, file);
  }
});

test("tworzenie i edycja meczu wymagają WRITE, a usuwanie centralnej capability ADMIN", () => {
  const source = actionSource("match-actions.ts");
  assert.ok((source.match(/requireWriteUser\(\)/gu) ?? []).length >= 2);
  assert.match(source, /canAdminister\(user\.role\)/u);
});
