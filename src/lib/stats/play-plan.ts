export type PlayPlanPriority = "TOP" | "VALUE" | "WATCH" | "BLOCKED";
export type PlayPlanItemStatus = "SELECTED" | "PLAYED" | "SKIPPED";

export type PlayPlanRecommendationSnapshot = {
  capturedAt: string;
  matchId: string;
  kickoffAt: string;
  leagueId: string;
  leagueName: string;
  seasonName: string;
  homeTeamName: string;
  awayTeamName: string;
  statKey: string;
  statLabel: string;
  scope: string;
  target: string;
  side: string;
  threshold: number;
  source: string;
  recommendationPriority: PlayPlanPriority;
  recommendationScore: number;
  expectedValue: number | null;
  modelProbability: number | null;
  fairOdds: number | null;
  marketStatus: string | null;
  evidenceStatus: string | null;
  bestStrategy: {
    strategyVersionId: string;
    strategyName: string;
    version: number;
    healthStatus: string;
    healthScore: number | null;
    exposureStatus: string;
    recommendedStake: number | null;
    stakeMode: string;
  } | null;
  reasons: string[];
  warnings: string[];
  blockers: string[];
};

export type PlayPlanSettings = {
  bankroll: number;
  maxDailyStakePercent: number;
  maxMatchStakePercent: number;
  maxLeagueStakePercent: number;
  maxMarketStakePercent: number;
};

export type PlayPlanItemInput = {
  id: string;
  matchId: string;
  leagueId: string;
  statKey: string;
  scope: string;
  target: string;
  side: string;
  threshold: number;
  kickoffAt: Date;
  priority: PlayPlanPriority;
  score: number;
  expectedValue: number | null;
  plannedStake: number | null;
  odds: number | null;
  status: PlayPlanItemStatus;
  actualStatus?: string | null;
};

export type PlayPlanItemAssessment = {
  blockers: string[];
  warnings: string[];
};

export type PlayPlanExposure = {
  key: string;
  stake: number;
  percent: number | null;
  limitPercent: number;
  exceeded: boolean;
};

export type PlayPlanEvaluation = {
  items: number;
  playedItems: number;
  skippedItems: number;
  totalStake: number;
  stakePercent: number | null;
  averageScore: number | null;
  weightedExpectedValue: number | null;
  expectedProfit: number | null;
  expectedValueCoverage: number;
  itemAssessments: Record<string, PlayPlanItemAssessment>;
  matchExposure: PlayPlanExposure[];
  leagueExposure: PlayPlanExposure[];
  marketExposure: PlayPlanExposure[];
  blockers: string[];
  warnings: string[];
  approvable: boolean;
};

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function finitePositive(value: number | null | undefined) {
  const parsed = finite(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function percentage(part: number, total: number) {
  return total > 0 ? (part / total) * 100 : null;
}

function conflictKey(item: PlayPlanItemInput) {
  return [
    item.matchId,
    item.statKey,
    item.scope,
    item.target,
    item.threshold.toFixed(4),
  ].join("|");
}

function exposure(
  items: PlayPlanItemInput[],
  bankroll: number,
  limitPercent: number,
  key: (item: PlayPlanItemInput) => string,
) {
  const groups = new Map<string, number>();
  for (const item of items) {
    const stake = finitePositive(item.plannedStake);
    if (stake === null) continue;
    const groupKey = key(item);
    groups.set(groupKey, (groups.get(groupKey) ?? 0) + stake);
  }
  return [...groups.entries()]
    .map(([groupKey, stake]) => {
      const percent = percentage(stake, bankroll);
      return {
        key: groupKey,
        stake: money(stake),
        percent,
        limitPercent,
        exceeded: percent !== null && percent > limitPercent,
      };
    })
    .sort((left, right) => right.stake - left.stake || left.key.localeCompare(right.key));
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function evaluatePlayPlan(input: {
  settings: PlayPlanSettings;
  items: PlayPlanItemInput[];
  now?: Date;
}): PlayPlanEvaluation {
  const now = input.now ?? new Date();
  const bankroll = finitePositive(input.settings.bankroll) ?? 0;
  const itemAssessments: Record<string, PlayPlanItemAssessment> = {};
  const blockers: string[] = [];
  const warnings: string[] = [];

  const groupedSides = new Map<string, Set<string>>();
  const matchCounts = new Map<string, number>();
  for (const item of input.items) {
    if (item.status === "SKIPPED") continue;
    const key = conflictKey(item);
    const sides = groupedSides.get(key) ?? new Set<string>();
    sides.add(item.side);
    groupedSides.set(key, sides);
    matchCounts.set(item.matchId, (matchCounts.get(item.matchId) ?? 0) + 1);
  }

  for (const item of input.items) {
    const itemBlockers: string[] = [];
    const itemWarnings: string[] = [];
    if (item.status === "SKIPPED") {
      itemAssessments[item.id] = { blockers: [], warnings: [] };
      continue;
    }
    const stake = finitePositive(item.plannedStake);
    const odds = finitePositive(item.odds);
    const ev = finite(item.expectedValue);
    if (item.status === "SELECTED" && item.actualStatus && item.actualStatus !== "WATCHING") {
      itemBlockers.push("Pozycja została już zagrana lub rozliczona poza planem.");
    }

    if (item.priority === "BLOCKED") {
      itemBlockers.push("Rekomendacja ma status odrzucona.");
    }
    if (stake === null) {
      itemBlockers.push("Brak prawidłowej stawki.");
    }
    if (odds === null || odds <= 1) {
      itemBlockers.push("Brak prawidłowego kursu.");
    }
    if (item.status !== "PLAYED" && item.kickoffAt.getTime() <= now.getTime()) {
      itemBlockers.push("Mecz już się rozpoczął.");
    }
    if ((groupedSides.get(conflictKey(item))?.size ?? 0) > 1) {
      itemBlockers.push("Plan zawiera przeciwne kierunki dla tej samej linii.");
    }
    if (ev === null) {
      itemWarnings.push("Brak EV w zapisanym snapshotcie.");
    } else if (ev <= 0) {
      itemBlockers.push("EV nie jest dodatnie.");
    }
    if (item.priority === "WATCH") {
      itemWarnings.push("Pozycja ma priorytet obserwuj.");
    }
    if ((matchCounts.get(item.matchId) ?? 0) > 1) {
      itemWarnings.push("Plan zawiera więcej niż jedną pozycję z tego meczu.");
    }

    itemAssessments[item.id] = {
      blockers: unique(itemBlockers),
      warnings: unique(itemWarnings),
    };
    blockers.push(...itemBlockers.map((message) => `${item.id}: ${message}`));
    warnings.push(...itemWarnings.map((message) => `${item.id}: ${message}`));
  }

  const activeItems = input.items.filter((item) => item.status !== "SKIPPED");
  const totalStake = money(activeItems.reduce((sum, item) => {
    const stake = finitePositive(item.plannedStake);
    return stake === null ? sum : sum + stake;
  }, 0));
  const stakePercent = percentage(totalStake, bankroll);
  const dailyLimit = Math.max(0, input.settings.maxDailyStakePercent);
  if (bankroll <= 0) blockers.push("Kapitał planu musi być większy od zera.");
  if (stakePercent !== null && stakePercent > dailyLimit) {
    blockers.push(`Łączna stawka przekracza limit dnia ${dailyLimit}%.`);
  }

  const matchExposure = exposure(
    activeItems,
    bankroll,
    Math.max(0, input.settings.maxMatchStakePercent),
    (item) => item.matchId,
  );
  const leagueExposure = exposure(
    activeItems,
    bankroll,
    Math.max(0, input.settings.maxLeagueStakePercent),
    (item) => item.leagueId,
  );
  const marketExposure = exposure(
    activeItems,
    bankroll,
    Math.max(0, input.settings.maxMarketStakePercent),
    (item) => item.statKey,
  );

  for (const item of matchExposure.filter((row) => row.exceeded)) {
    blockers.push(`Ekspozycja na mecz ${item.key} przekracza limit ${item.limitPercent}%.`);
  }
  for (const item of leagueExposure.filter((row) => row.exceeded)) {
    blockers.push(`Ekspozycja na ligę ${item.key} przekracza limit ${item.limitPercent}%.`);
  }
  for (const item of marketExposure.filter((row) => row.exceeded)) {
    blockers.push(`Ekspozycja na rynek ${item.key} przekracza limit ${item.limitPercent}%.`);
  }

  const evRows = activeItems.flatMap((item) => {
    const stake = finitePositive(item.plannedStake);
    const ev = finite(item.expectedValue);
    return stake === null || ev === null ? [] : [{ stake, ev }];
  });
  const evStake = evRows.reduce((sum, row) => sum + row.stake, 0);
  const expectedProfit = evRows.length
    ? money(evRows.reduce((sum, row) => sum + row.stake * (row.ev / 100), 0))
    : null;
  const weightedExpectedValue = evStake > 0
    ? evRows.reduce((sum, row) => sum + row.stake * row.ev, 0) / evStake
    : null;
  const averageScore = activeItems.length
    ? activeItems.reduce((sum, item) => sum + item.score, 0) / activeItems.length
    : null;

  const uniqueBlockers = unique(blockers);
  const uniqueWarnings = unique(warnings);
  return {
    items: input.items.length,
    playedItems: input.items.filter((item) => item.status === "PLAYED").length,
    skippedItems: input.items.filter((item) => item.status === "SKIPPED").length,
    totalStake,
    stakePercent,
    averageScore,
    weightedExpectedValue,
    expectedProfit,
    expectedValueCoverage: evRows.length,
    itemAssessments,
    matchExposure,
    leagueExposure,
    marketExposure,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    approvable: activeItems.length > 0 && uniqueBlockers.length === 0,
  };
}

export function playPlanStatusLabel(value: string) {
  if (value === "APPROVED") return "zatwierdzony";
  if (value === "ARCHIVED") return "archiwalny";
  return "roboczy";
}
