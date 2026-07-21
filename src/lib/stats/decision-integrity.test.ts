import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDecisionTiming,
  decisionAtForPick,
  isHistoricalDecisionEligible,
} from "@/lib/stats/decision-integrity";

test("decisionAt używa czasu kwotowania, a bez niego czasu utworzenia", () => {
  const createdAt = new Date("2026-07-21T12:00:00+02:00");
  const quoteCapturedAt = new Date("2026-07-21T09:30:00Z");
  assert.equal(decisionAtForPick({ createdAt, quoteCapturedAt }), quoteCapturedAt);
  assert.equal(decisionAtForPick({ createdAt, quoteCapturedAt: null }), createdAt);
});

test("granica kickoffu rozróżnia PRE_MATCH i LATE", () => {
  const kickoffAt = new Date("2026-07-21T18:00:00Z");
  assert.equal(classifyDecisionTiming({
    decisionAt: new Date("2026-07-21T17:59:59.999Z"),
    kickoffAt,
  }), "PRE_MATCH");
  assert.equal(classifyDecisionTiming({ decisionAt: kickoffAt, kickoffAt }), "LATE");
  assert.equal(classifyDecisionTiming({
    decisionAt: new Date("2026-07-21T18:00:00.001Z"),
    kickoffAt,
  }), "LATE");
});

test("walidacja historyczna dopuszcza wyłącznie decyzję PRE_MATCH", () => {
  const kickoffAt = new Date("2026-07-21T18:00:00Z");
  const decisionAt = new Date("2026-07-21T17:00:00Z");
  assert.equal(isHistoricalDecisionEligible({ decisionTiming: "PRE_MATCH", decisionAt, kickoffAt }), true);
  assert.equal(isHistoricalDecisionEligible({ decisionTiming: "LATE", decisionAt, kickoffAt }), false);
  assert.equal(isHistoricalDecisionEligible({ decisionTiming: "UNKNOWN", decisionAt, kickoffAt }), false);
});
