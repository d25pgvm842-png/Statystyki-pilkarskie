import { ImportStatus } from "@/generated/prisma/enums";

export type CurrentSyncCandidate = {
  id: string;
  label: string;
  lastSelectedAt: Date | string | null;
};

function timestamp(value: Date | string | null) {
  if (!value) return 0;
  const parsed = value instanceof Date ? value : new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function selectNextCurrentSyncCandidate<T extends CurrentSyncCandidate>(candidates: T[]) {
  return [...candidates].sort((left, right) => {
    const byPreparedAt = timestamp(left.lastSelectedAt) - timestamp(right.lastSelectedAt);
    if (byPreparedAt !== 0) return byPreparedAt;
    const byLabel = left.label.localeCompare(right.label, "pl");
    if (byLabel !== 0) return byLabel;
    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

export function isActiveCurrentSyncBatch(status: ImportStatus | string) {
  return status === ImportStatus.READY || status === ImportStatus.VALIDATING;
}

export function parseCurrentSyncDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}
