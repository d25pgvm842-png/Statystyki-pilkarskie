import assert from "node:assert/strict";
import test from "node:test";
import { createManualOverrideWritePlan } from "./manual-overrides";

test("pełny zapis statystyk używa dwóch operacji zbiorczych", () => {
  const fields = [
    "homeCorners",
    "awayCorners",
    "homeYellowCards",
    "awayYellowCards",
    "homeRedCards",
    "awayRedCards",
    "homeShotsOnTarget",
    "awayShotsOnTarget",
    "homeShots",
    "awayShots",
    "homeFouls",
    "awayFouls",
    "homeOffsides",
    "awayOffsides",
  ];

  const plan = createManualOverrideWritePlan("match-1", "user-1", fields);

  assert.ok(plan);
  assert.equal(plan.update.where.fieldName.in.length, 14);
  assert.equal(plan.create.data.length, 14);
  assert.equal(plan.create.skipDuplicates, true);
});

test("usuwa duplikaty i pomija zapis bez zmian", () => {
  const plan = createManualOverrideWritePlan(
    "match-1",
    "user-1",
    ["homeCorners", "homeCorners"],
  );

  assert.ok(plan);
  assert.deepEqual(plan.update.where.fieldName.in, ["homeCorners"]);
  assert.equal(plan.create.data.length, 1);
  assert.equal(createManualOverrideWritePlan("match-1", "user-1", []), null);
});
