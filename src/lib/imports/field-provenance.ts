import type { Prisma } from "@/generated/prisma/client";
import {
  decideTrackedField,
  type FieldDecision,
  type TrackedValue,
} from "@/lib/imports/field-provenance-policy";

type TransactionClient = Prisma.TransactionClient;

export const TRACKED_EXTERNAL_FIELDS = [
  "homeScore",
  "awayScore",
  "refereeId",
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
] as const;

export type TrackedExternalField = (typeof TRACKED_EXTERNAL_FIELDS)[number];

export type PreparedFieldDecision = FieldDecision & {
  fieldName: TrackedExternalField;
};

function storedValue(value: TrackedValue) {
  if (value === null || value === undefined) return null;
  return String(value);
}

export async function prepareExternalFieldDecisions(input: {
  tx: TransactionClient;
  matchId: string;
  primarySourceId: string | null;
  sourceId: string;
  lockedFields: Set<string>;
  currentValues: Partial<Record<TrackedExternalField, TrackedValue>>;
  incomingValues: Partial<Record<TrackedExternalField, TrackedValue>>;
}) {
  const existing = await input.tx.matchFieldObservation.findMany({
    where: {
      matchId: input.matchId,
      fieldName: { in: [...TRACKED_EXTERNAL_FIELDS] },
    },
    select: {
      fieldName: true,
      dataSourceId: true,
      active: true,
    },
  });

  const observedFields = new Set(existing.map((item) => item.fieldName));
  const activeForSource = new Set(
    existing
      .filter((item) => item.dataSourceId === input.sourceId && item.active)
      .map((item) => item.fieldName),
  );

  const decisions = TRACKED_EXTERNAL_FIELDS.map((fieldName): PreparedFieldDecision => {
    const sameSource = activeForSource.has(fieldName)
      || (!observedFields.has(fieldName) && input.primarySourceId === input.sourceId);
    return {
      fieldName,
      ...decideTrackedField({
        currentValue: input.currentValues[fieldName],
        incomingValue: input.incomingValues[fieldName],
        locked: input.lockedFields.has(fieldName),
        sameSource,
      }),
    };
  });

  return {
    decisions,
    nextValues: Object.fromEntries(
      decisions.map((decision) => [decision.fieldName, decision.nextValue ?? null]),
    ) as Record<TrackedExternalField, string | number | boolean | null>,
    conflictCount: decisions.filter((decision) => decision.conflict).length,
  };
}

export async function persistExternalFieldDecisions(input: {
  tx: TransactionClient;
  matchId: string;
  sourceId: string;
  importRowId: string;
  sourceExternalId?: string | null;
  sourceUpdatedAt?: Date | null;
  decisions: PreparedFieldDecision[];
}) {
  const observedAt = new Date();

  for (const decision of input.decisions) {
    const value = storedValue(decision.incomingValue);
    if (value === null) continue;

    if (decision.active) {
      await input.tx.matchFieldObservation.updateMany({
        where: {
          matchId: input.matchId,
          fieldName: decision.fieldName,
          active: true,
          dataSourceId: { not: input.sourceId },
        },
        data: { active: false },
      });
    }

    await input.tx.matchFieldObservation.upsert({
      where: {
        matchId_fieldName_dataSourceId: {
          matchId: input.matchId,
          fieldName: decision.fieldName,
          dataSourceId: input.sourceId,
        },
      },
      update: {
        importRowId: input.importRowId,
        value,
        active: decision.active,
        conflict: decision.conflict,
        ignoredByOverride: decision.ignoredByOverride,
        sourceExternalId: input.sourceExternalId ?? null,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        observedAt,
      },
      create: {
        matchId: input.matchId,
        dataSourceId: input.sourceId,
        importRowId: input.importRowId,
        fieldName: decision.fieldName,
        value,
        active: decision.active,
        conflict: decision.conflict,
        ignoredByOverride: decision.ignoredByOverride,
        sourceExternalId: input.sourceExternalId ?? null,
        sourceUpdatedAt: input.sourceUpdatedAt ?? null,
        observedAt,
      },
    });
  }
}

export async function recordInitialFieldObservations(input: {
  tx: TransactionClient;
  matchId: string;
  sourceId: string;
  importRowId: string;
  sourceExternalId?: string | null;
  sourceUpdatedAt?: Date | null;
  values: Partial<Record<TrackedExternalField, TrackedValue>>;
}) {
  const decisions = TRACKED_EXTERNAL_FIELDS.map((fieldName): PreparedFieldDecision => {
    const incomingValue = input.values[fieldName] ?? null;
    return {
      fieldName,
      currentValue: null,
      incomingValue,
      nextValue: incomingValue,
      kind: incomingValue === null ? "MISSING" : "INITIAL",
      active: incomingValue !== null,
      conflict: false,
      ignoredByOverride: false,
    };
  });

  await persistExternalFieldDecisions({
    tx: input.tx,
    matchId: input.matchId,
    sourceId: input.sourceId,
    importRowId: input.importRowId,
    sourceExternalId: input.sourceExternalId,
    sourceUpdatedAt: input.sourceUpdatedAt,
    decisions,
  });
}
