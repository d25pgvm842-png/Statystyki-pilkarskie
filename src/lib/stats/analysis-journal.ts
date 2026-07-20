export type JournalSide = "OVER" | "UNDER";
export type JournalResult = "WIN" | "LOSS" | "PUSH" | "VOID";

export type JournalMetricEntry = {
  status: string;
  result: JournalResult | null;
  odds: number | null;
  closingOdds: number | null;
  stake: number | null;
};

export type JournalAnalyticsEntry = JournalMetricEntry & {
  leagueId: string;
  leagueName: string;
  statKey: string;
  statLabel: string;
  side: JournalSide;
  source: string;
  evidenceStatus: string | null;
};

export type JournalMetrics = {
  watching: number;
  playedOpen: number;
  rejected: number;
  settled: number;
  voided: number;
  wins: number;
  losses: number;
  pushes: number;
  hitRate: number | null;
  turnover: number;
  profit: number;
  roi: number | null;
  averageOdds: number | null;
  averageClv: number | null;
  financialEntries: number;
};

export type JournalAnalyticsRow = JournalMetrics & {
  key: string;
  label: string;
  totalEntries: number;
  smallSample: boolean;
};

export type JournalAnalytics = {
  byLeague: JournalAnalyticsRow[];
  byMarket: JournalAnalyticsRow[];
  bySide: JournalAnalyticsRow[];
  bySource: JournalAnalyticsRow[];
  byEvidence: JournalAnalyticsRow[];
};

type JournalAnalyticsDimension =
  | "league"
  | "market"
  | "side"
  | "source"
  | "evidence";

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildAnalysisPickFingerprint(input: {
  matchId: string;
  statKey: string;
  scope: string;
  selectedTeamId?: string | null;
  threshold: number;
  side: JournalSide;
}) {
  const parts = [
    input.matchId.trim(),
    input.statKey.trim(),
    input.scope.trim(),
  ];
  if (input.selectedTeamId) parts.push(input.selectedTeamId.trim());
  parts.push(input.threshold.toFixed(3), input.side);
  return parts.join("|");
}

export function settleTotalSelection(input: {
  actual: number;
  threshold: number;
  side: JournalSide;
}): Exclude<JournalResult, "VOID"> {
  if (input.actual === input.threshold) return "PUSH";
  if (input.side === "OVER") {
    return input.actual > input.threshold ? "WIN" : "LOSS";
  }
  return input.actual < input.threshold ? "WIN" : "LOSS";
}

export function selectionProfit(input: {
  result: JournalResult | null;
  odds: number | null;
  stake: number | null;
}) {
  if (
    !input.result
    || input.stake === null
    || !Number.isFinite(input.stake)
    || input.stake <= 0
  ) {
    return null;
  }
  if (
    input.odds === null
    || !Number.isFinite(input.odds)
    || input.odds <= 1
  ) {
    return null;
  }
  if (input.result === "LOSS") return -input.stake;
  if (input.result === "PUSH" || input.result === "VOID") return 0;
  return Math.round(input.stake * (input.odds - 1) * 100) / 100;
}

export function selectionClv(input: {
  odds: number | null;
  closingOdds: number | null;
}) {
  if (
    input.odds === null
    || input.closingOdds === null
    || !Number.isFinite(input.odds)
    || !Number.isFinite(input.closingOdds)
    || input.odds <= 1
    || input.closingOdds <= 1
  ) {
    return null;
  }
  return ((input.odds / input.closingOdds) - 1) * 100;
}

export function summarizeJournal(entries: JournalMetricEntry[]): JournalMetrics {
  const watching = entries.filter((entry) => entry.status === "WATCHING").length;
  const playedOpen = entries.filter((entry) => entry.status === "PLAYED").length;
  const rejected = entries.filter((entry) => entry.status === "REJECTED").length;
  const settledEntries = entries.filter((entry) => entry.status === "SETTLED");
  const voided = entries.filter(
    (entry) => entry.status === "VOID" || entry.result === "VOID",
  ).length;

  const wins = settledEntries.filter((entry) => entry.result === "WIN").length;
  const losses = settledEntries.filter((entry) => entry.result === "LOSS").length;
  const pushes = settledEntries.filter((entry) => entry.result === "PUSH").length;

  const financialRows = settledEntries.flatMap((entry) => {
    const profit = selectionProfit(entry);
    return profit === null ? [] : [{ entry, profit }];
  });
  const financialEntries = financialRows.length;
  const turnover = financialRows.reduce((sum, row) => {
    const stake = row.entry.stake;
    return stake !== null && Number.isFinite(stake) && stake > 0
      ? sum + stake
      : sum;
  }, 0);
  const profit = financialRows.reduce((sum, row) => sum + row.profit, 0);
  const odds = settledEntries
    .map((entry) => entry.odds)
    .filter((value): value is number =>
      value !== null && Number.isFinite(value) && value > 1,
    );
  const clv = settledEntries
    .map((entry) => selectionClv(entry))
    .filter((value): value is number => value !== null);

  return {
    watching,
    playedOpen,
    rejected,
    settled: settledEntries.length,
    voided,
    wins,
    losses,
    pushes,
    hitRate: wins + losses ? (wins / (wins + losses)) * 100 : null,
    turnover,
    profit,
    roi: turnover > 0 ? (profit / turnover) * 100 : null,
    averageOdds: average(odds),
    averageClv: average(clv),
    financialEntries,
  };
}

function analyticsGroup(entry: JournalAnalyticsEntry, dimension: JournalAnalyticsDimension) {
  if (dimension === "league") {
    return { key: entry.leagueId, label: entry.leagueName };
  }
  if (dimension === "market") {
    return { key: entry.statKey, label: entry.statLabel };
  }
  if (dimension === "side") {
    return { key: entry.side, label: entry.side };
  }
  if (dimension === "source") {
    return {
      key: entry.source,
      label: entry.source === "SCANNER" ? "Skaner" : "Ręczne",
    };
  }

  const evidence = entry.evidenceStatus ?? "NONE";
  const labels: Record<string, string> = {
    SUPPORTED: "Wsparte historią",
    WATCH: "Do obserwacji",
    WEAK: "Słaba historia",
    UNVERIFIED: "Niezweryfikowane",
    NONE: "Brak statusu",
  };
  return { key: evidence, label: labels[evidence] ?? evidence };
}

export function groupJournalAnalytics(
  entries: JournalAnalyticsEntry[],
  dimension: JournalAnalyticsDimension,
): JournalAnalyticsRow[] {
  const groups = new Map<string, { label: string; entries: JournalAnalyticsEntry[] }>();

  for (const entry of entries) {
    const group = analyticsGroup(entry, dimension);
    const current = groups.get(group.key);
    if (current) {
      current.entries.push(entry);
    } else {
      groups.set(group.key, { label: group.label, entries: [entry] });
    }
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const metrics = summarizeJournal(group.entries);
      return {
        key,
        label: group.label,
        totalEntries: group.entries.length,
        smallSample: metrics.settled < 10,
        ...metrics,
      };
    })
    .sort(
      (left, right) =>
        right.settled - left.settled
        || right.totalEntries - left.totalEntries
        || left.label.localeCompare(right.label, "pl"),
    );
}

export function summarizeJournalAnalytics(
  entries: JournalAnalyticsEntry[],
): JournalAnalytics {
  return {
    byLeague: groupJournalAnalytics(entries, "league"),
    byMarket: groupJournalAnalytics(entries, "market"),
    bySide: groupJournalAnalytics(entries, "side"),
    bySource: groupJournalAnalytics(entries, "source"),
    byEvidence: groupJournalAnalytics(entries, "evidence"),
  };
}
