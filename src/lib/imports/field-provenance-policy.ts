export type TrackedValue = string | number | boolean | null | undefined;

export type FieldDecisionKind =
  | "MISSING"
  | "INITIAL"
  | "SAME_SOURCE_UPDATE"
  | "SUPPORTING"
  | "CONFLICT"
  | "OVERRIDE";

export type FieldDecision = {
  currentValue: TrackedValue;
  incomingValue: TrackedValue;
  nextValue: TrackedValue;
  kind: FieldDecisionKind;
  active: boolean;
  conflict: boolean;
  ignoredByOverride: boolean;
};

function sameValue(left: TrackedValue, right: TrackedValue) {
  return Object.is(left ?? null, right ?? null);
}

export function decideTrackedField(input: {
  currentValue: TrackedValue;
  incomingValue: TrackedValue;
  locked: boolean;
  sameSource: boolean;
}): FieldDecision {
  const currentValue = input.currentValue ?? null;
  const incomingValue = input.incomingValue ?? null;

  if (incomingValue === null) {
    return {
      currentValue,
      incomingValue,
      nextValue: currentValue,
      kind: "MISSING",
      active: false,
      conflict: false,
      ignoredByOverride: false,
    };
  }

  if (input.locked) {
    return {
      currentValue,
      incomingValue,
      nextValue: currentValue,
      kind: "OVERRIDE",
      active: false,
      conflict: currentValue !== null && !sameValue(currentValue, incomingValue),
      ignoredByOverride: true,
    };
  }

  if (currentValue === null) {
    return {
      currentValue,
      incomingValue,
      nextValue: incomingValue,
      kind: "INITIAL",
      active: true,
      conflict: false,
      ignoredByOverride: false,
    };
  }

  if (sameValue(currentValue, incomingValue)) {
    return {
      currentValue,
      incomingValue,
      nextValue: currentValue,
      kind: input.sameSource ? "SAME_SOURCE_UPDATE" : "SUPPORTING",
      active: input.sameSource,
      conflict: false,
      ignoredByOverride: false,
    };
  }

  if (input.sameSource) {
    return {
      currentValue,
      incomingValue,
      nextValue: incomingValue,
      kind: "SAME_SOURCE_UPDATE",
      active: true,
      conflict: false,
      ignoredByOverride: false,
    };
  }

  return {
    currentValue,
    incomingValue,
    nextValue: currentValue,
    kind: "CONFLICT",
    active: false,
    conflict: true,
    ignoredByOverride: false,
  };
}
