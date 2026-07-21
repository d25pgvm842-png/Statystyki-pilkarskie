import { summarizeBettingFinancials } from "@/lib/stats/betting-metrics";

export type CalibrationEntry = {
  status: string;
  result: string | null;
  odds: number | null;
  stake: number | null;
  modelProbability: number | null;
  expectedValue: number | null;
  modelVersion: string | null;
  leagueId: string;
  leagueName: string;
  statKey: string;
  statLabel: string;
  side: string;
};

export type CalibrationMetrics = {
  totalEntries: number;
  snapshotEntries: number;
  snapshotCoverage: number | null;
  probabilityEntries: number;
  expectedValueEntries: number;
  watching: number;
  playedOpen: number;
  rejected: number;
  settled: number;
  voided: number;
  resolvedEntries: number;
  wins: number;
  losses: number;
  averageModelProbability: number | null;
  actualHitRate: number | null;
  calibrationGap: number | null;
  brierScore: number | null;
  averageExpectedValue: number | null;
  financialEntries: number;
  turnover: number;
  profit: number;
  roi: number | null;
};

export type CalibrationSegmentRow = CalibrationMetrics & {
  key: string;
  label: string;
  smallSample: boolean;
};

export type JournalCalibration = {
  summary: CalibrationMetrics;
  byProbability: CalibrationSegmentRow[];
  byExpectedValue: CalibrationSegmentRow[];
  byLeague: CalibrationSegmentRow[];
  byMarket: CalibrationSegmentRow[];
  bySide: CalibrationSegmentRow[];
  byModelVersion: CalibrationSegmentRow[];
  byDecisionStatus: CalibrationSegmentRow[];
};

type CalibrationDimension =
  | "league"
  | "market"
  | "side"
  | "modelVersion"
  | "decisionStatus";

const probabilityBucketOrder = ["lt50", "50_55", "55_60", "60_65", "65_plus"];
const expectedValueBucketOrder = ["negative", "0_2", "2_5", "5_10", "10_plus"];

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function finiteNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validProbability(value: number | null | undefined) {
  const number = finiteNumber(value);
  return number !== null && number >= 0 && number <= 100 ? number : null;
}

function validExpectedValue(value: number | null | undefined) {
  return finiteNumber(value);
}

function hasSnapshot(entry: CalibrationEntry) {
  return Boolean(entry.modelVersion?.trim())
    || validProbability(entry.modelProbability) !== null
    || validExpectedValue(entry.expectedValue) !== null;
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

export function summarizeCalibration(entries: CalibrationEntry[]): CalibrationMetrics {
  const snapshotEntries = entries.filter(hasSnapshot);
  const probabilityEntries = snapshotEntries.filter(
    (entry) => validProbability(entry.modelProbability) !== null,
  );
  const expectedValueEntries = snapshotEntries.filter(
    (entry) => validExpectedValue(entry.expectedValue) !== null,
  );
  const resolved = probabilityEntries.filter(
    (entry) => entry.status === "SETTLED" && (entry.result === "WIN" || entry.result === "LOSS"),
  );
  const wins = resolved.filter((entry) => entry.result === "WIN").length;
  const losses = resolved.filter((entry) => entry.result === "LOSS").length;
  const averageModelProbability = average(
    resolved.flatMap((entry) => {
      const probability = validProbability(entry.modelProbability);
      return probability === null ? [] : [probability];
    }),
  );
  const actualHitRate = percentage(wins, wins + losses);
  const brierValues = resolved.flatMap((entry) => {
    const probability = validProbability(entry.modelProbability);
    if (probability === null) return [];
    const outcome = entry.result === "WIN" ? 1 : 0;
    return [((probability / 100) - outcome) ** 2];
  });

  const settledFinancial = snapshotEntries.filter((entry) => entry.status === "SETTLED");
  const financial = summarizeBettingFinancials({
    entries: settledFinancial,
    financialInput: (entry) => ({
      result: entry.result as "WIN" | "LOSS" | "PUSH" | "VOID" | null,
      odds: entry.odds,
      stake: entry.stake,
    }),
  });

  return {
    totalEntries: entries.length,
    snapshotEntries: snapshotEntries.length,
    snapshotCoverage: percentage(snapshotEntries.length, entries.length),
    probabilityEntries: probabilityEntries.length,
    expectedValueEntries: expectedValueEntries.length,
    watching: snapshotEntries.filter((entry) => entry.status === "WATCHING").length,
    playedOpen: snapshotEntries.filter((entry) => entry.status === "PLAYED").length,
    rejected: snapshotEntries.filter((entry) => entry.status === "REJECTED").length,
    settled: snapshotEntries.filter((entry) => entry.status === "SETTLED").length,
    voided: snapshotEntries.filter(
      (entry) => entry.status === "VOID" || entry.result === "VOID",
    ).length,
    resolvedEntries: resolved.length,
    wins,
    losses,
    averageModelProbability,
    actualHitRate,
    calibrationGap:
      actualHitRate !== null && averageModelProbability !== null
        ? actualHitRate - averageModelProbability
        : null,
    brierScore: average(brierValues),
    averageExpectedValue: average(
      expectedValueEntries.flatMap((entry) => {
        const expectedValue = validExpectedValue(entry.expectedValue);
        return expectedValue === null ? [] : [expectedValue];
      }),
    ),
    financialEntries: financial.financialEntries,
    turnover: financial.turnover,
    profit: financial.profit,
    roi: financial.roi,
  };
}

export function probabilityCalibrationBucket(probability: number) {
  if (probability < 50) return { key: "lt50", label: "Poniżej 50%" };
  if (probability < 55) return { key: "50_55", label: "50–<55%" };
  if (probability < 60) return { key: "55_60", label: "55–<60%" };
  if (probability < 65) return { key: "60_65", label: "60–<65%" };
  return { key: "65_plus", label: "65% i więcej" };
}

export function expectedValueCalibrationBucket(expectedValue: number) {
  if (expectedValue < 0) return { key: "negative", label: "EV poniżej 0%" };
  if (expectedValue < 2) return { key: "0_2", label: "EV 0–<2%" };
  if (expectedValue < 5) return { key: "2_5", label: "EV 2–<5%" };
  if (expectedValue < 10) return { key: "5_10", label: "EV 5–<10%" };
  return { key: "10_plus", label: "EV 10% i więcej" };
}

function segmentRow(key: string, label: string, entries: CalibrationEntry[]): CalibrationSegmentRow {
  const metrics = summarizeCalibration(entries);
  return {
    key,
    label,
    smallSample: metrics.resolvedEntries < 10,
    ...metrics,
  };
}

function groupByBuckets(
  entries: CalibrationEntry[],
  value: (entry: CalibrationEntry) => number | null,
  bucket: (value: number) => { key: string; label: string },
  order: string[],
) {
  const groups = new Map<string, { label: string; entries: CalibrationEntry[] }>();
  for (const entry of entries) {
    const numericValue = value(entry);
    if (numericValue === null) continue;
    const selected = bucket(numericValue);
    const current = groups.get(selected.key);
    if (current) current.entries.push(entry);
    else groups.set(selected.key, { label: selected.label, entries: [entry] });
  }

  return order.flatMap((key) => {
    const group = groups.get(key);
    return group ? [segmentRow(key, group.label, group.entries)] : [];
  });
}

function calibrationGroup(entry: CalibrationEntry, dimension: CalibrationDimension) {
  if (dimension === "league") return { key: entry.leagueId, label: entry.leagueName };
  if (dimension === "market") return { key: entry.statKey, label: entry.statLabel };
  if (dimension === "side") return { key: entry.side, label: entry.side };
  if (dimension === "modelVersion") {
    const version = entry.modelVersion?.trim() || "NONE";
    return { key: version, label: version === "NONE" ? "Brak wersji modelu" : version };
  }

  const labels: Record<string, string> = {
    WATCHING: "Obserwowane",
    PLAYED: "Zagrane otwarte",
    REJECTED: "Odrzucone",
    SETTLED: "Rozliczone",
    VOID: "Void",
  };
  return { key: entry.status, label: labels[entry.status] ?? entry.status };
}

export function groupCalibration(
  entries: CalibrationEntry[],
  dimension: CalibrationDimension,
): CalibrationSegmentRow[] {
  const groups = new Map<string, { label: string; entries: CalibrationEntry[] }>();
  for (const entry of entries.filter(hasSnapshot)) {
    const group = calibrationGroup(entry, dimension);
    const current = groups.get(group.key);
    if (current) current.entries.push(entry);
    else groups.set(group.key, { label: group.label, entries: [entry] });
  }

  const statusOrder = ["WATCHING", "PLAYED", "SETTLED", "REJECTED", "VOID"];
  const rows = [...groups.entries()].map(([key, group]) => segmentRow(key, group.label, group.entries));
  if (dimension === "decisionStatus") {
    return rows.sort((left, right) => statusOrder.indexOf(left.key) - statusOrder.indexOf(right.key));
  }
  return rows.sort(
    (left, right) =>
      right.resolvedEntries - left.resolvedEntries
      || right.snapshotEntries - left.snapshotEntries
      || left.label.localeCompare(right.label, "pl"),
  );
}

export function summarizeJournalCalibration(entries: CalibrationEntry[]): JournalCalibration {
  const snapshotEntries = entries.filter(hasSnapshot);
  return {
    summary: summarizeCalibration(entries),
    byProbability: groupByBuckets(
      snapshotEntries,
      (entry) => validProbability(entry.modelProbability),
      probabilityCalibrationBucket,
      probabilityBucketOrder,
    ),
    byExpectedValue: groupByBuckets(
      snapshotEntries,
      (entry) => validExpectedValue(entry.expectedValue),
      expectedValueCalibrationBucket,
      expectedValueBucketOrder,
    ),
    byLeague: groupCalibration(snapshotEntries, "league"),
    byMarket: groupCalibration(snapshotEntries, "market"),
    bySide: groupCalibration(snapshotEntries, "side"),
    byModelVersion: groupCalibration(snapshotEntries, "modelVersion"),
    byDecisionStatus: groupCalibration(snapshotEntries, "decisionStatus"),
  };
}
