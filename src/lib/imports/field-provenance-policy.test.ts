import assert from "node:assert/strict";
import test from "node:test";
import { decideTrackedField } from "@/lib/imports/field-provenance-policy";

test("brak z nowego źródła nie kasuje istniejącej wartości", () => {
  const decision = decideTrackedField({
    currentValue: 7,
    incomingValue: null,
    locked: false,
    sameSource: false,
  });
  assert.equal(decision.nextValue, 7);
  assert.equal(decision.kind, "MISSING");
});

test("puste pole może zostać uzupełnione przez nowe źródło", () => {
  const decision = decideTrackedField({
    currentValue: null,
    incomingValue: 7,
    locked: false,
    sameSource: false,
  });
  assert.equal(decision.nextValue, 7);
  assert.equal(decision.active, true);
});

test("inna wartość z obcego źródła tworzy konflikt i nie nadpisuje danych", () => {
  const decision = decideTrackedField({
    currentValue: 7,
    incomingValue: 9,
    locked: false,
    sameSource: false,
  });
  assert.equal(decision.nextValue, 7);
  assert.equal(decision.conflict, true);
  assert.equal(decision.kind, "CONFLICT");
});

test("to samo źródło może poprawić własną wartość", () => {
  const decision = decideTrackedField({
    currentValue: 7,
    incomingValue: 9,
    locked: false,
    sameSource: true,
  });
  assert.equal(decision.nextValue, 9);
  assert.equal(decision.active, true);
  assert.equal(decision.kind, "SAME_SOURCE_UPDATE");
});

test("ręczna korekta zawsze wygrywa", () => {
  const decision = decideTrackedField({
    currentValue: 7,
    incomingValue: 9,
    locked: true,
    sameSource: true,
  });
  assert.equal(decision.nextValue, 7);
  assert.equal(decision.ignoredByOverride, true);
  assert.equal(decision.conflict, true);
});

test("zgodna wartość z drugiego źródła jest wsparciem, a nie konfliktem", () => {
  const decision = decideTrackedField({
    currentValue: 7,
    incomingValue: 7,
    locked: false,
    sameSource: false,
  });
  assert.equal(decision.nextValue, 7);
  assert.equal(decision.active, false);
  assert.equal(decision.conflict, false);
  assert.equal(decision.kind, "SUPPORTING");
});
