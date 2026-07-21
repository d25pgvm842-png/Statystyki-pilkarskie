import { prisma } from "@/lib/db";

type DailyPickRecord = {
  id: string;
  matchId: string;
  status: string;
  source: string;
  statKey: string;
  statLabel: string;
  scope: string;
  selectedTeamId: string | null;
  threshold: number;
  side: string;
  odds: number | null;
  bookmaker: string | null;
  modelProbability: number | null;
  expectedValue: number | null;
  fairOdds: number | null;
  modelSample: number | null;
  modelCoverage: number | null;
  modelConfidence: string | null;
  marketStatus: string | null;
  evidenceStatus: string | null;
  backtestSignals: number | null;
  backtestHitRate: number | null;
  edgeBacktestSignals: number | null;
  edgeBacktestHitRate: number | null;
  selectedTeam: { id: string; name: string } | null;
  match: {
    kickoffAt: Date;
    homeTeam: { id: string; name: string };
    awayTeam: { id: string; name: string };
    season: {
      id: string;
      name: string;
      league: { id: string; name: string };
    };
  };
  strategyForwardSignals: Array<{
    exposureStatus: string;
    recommendedStake: number | null;
    stakeMode: string;
    strategyVersion: {
      id: string;
      version: number;
      status: string;
      healthStatus: string;
      healthScore: number | null;
      strategy: { name: string };
    };
  }>;
};

import {
  evaluateDailyRecommendation,
  type DailyRecommendationEvaluation,
  type DailyRecommendationPriority,
  type DailyStrategySupport,
} from "@/lib/stats/daily-recommendations";

function conflictKey(item: {
  matchId: string;
  statKey: string;
  scope: string;
  selectedTeamId: string | null;
  threshold: number;
}) {
  return [
    item.matchId,
    item.statKey,
    item.scope,
    item.selectedTeamId ?? "MATCH",
    item.threshold.toFixed(4),
  ].join("|");
}

function strategySupport(signal: {
  exposureStatus: string;
  recommendedStake: number | null;
  stakeMode: string;
  strategyVersion: {
    id: string;
    version: number;
    status: string;
    healthStatus: string;
    healthScore: number | null;
    strategy: { name: string };
  };
}): DailyStrategySupport {
  return {
    strategyVersionId: signal.strategyVersion.id,
    strategyName: signal.strategyVersion.strategy.name,
    version: signal.strategyVersion.version,
    operationalStatus: signal.strategyVersion.status,
    healthStatus: signal.strategyVersion.healthStatus,
    healthScore: signal.strategyVersion.healthScore,
    exposureStatus: signal.exposureStatus,
    recommendedStake: signal.recommendedStake,
    stakeMode: signal.stakeMode,
  };
}

function priorityRank(value: DailyRecommendationPriority) {
  if (value === "TOP") return 0;
  if (value === "VALUE") return 1;
  if (value === "WATCH") return 2;
  return 3;
}

export async function loadDailyRecommendations(input: {
  userId: string;
  now?: Date;
  hours?: number;
  leagueId?: string | null;
  priority?: DailyRecommendationPriority | "ALL";
}) {
  const now = input.now ?? new Date();
  const hours = Math.max(6, Math.min(168, Math.floor(input.hours ?? 48)));
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000);

  const [picks, plannedItems] = await Promise.all([
    (prisma.analysisPick as unknown as {
      findMany(args: unknown): Promise<DailyPickRecord[]>;
    }).findMany({
    where: {
      userId: input.userId,
      status: { in: ["WATCHING", "PLAYED"] },
      match: {
        status: { in: ["SCHEDULED", "LIVE"] },
        kickoffAt: { gte: now, lte: until },
        ...(input.leagueId ? { season: { leagueId: input.leagueId } } : {}),
      },
    },
    include: {
      selectedTeam: { select: { id: true, name: true } },
      match: {
        include: {
          homeTeam: { select: { id: true, name: true } },
          awayTeam: { select: { id: true, name: true } },
          season: {
            include: { league: { select: { id: true, name: true } } },
          },
        },
      },
      strategyForwardSignals: {
        where: {
          strategyVersion: {
            endedAt: null,
            status: { in: ["FORWARD_TEST", "APPROVED"] },
          },
        },
        include: {
          strategyVersion: {
            include: { strategy: { select: { name: true } } },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
      orderBy: [
        { match: { kickoffAt: "asc" } },
        { createdAt: "asc" },
        { id: "asc" },
      ],
    }),
    prisma.dailyPlayPlanItem.findMany({
      where: { plan: { userId: input.userId } },
      select: { analysisPickId: true },
    }),
  ]);
  const plannedPickIds = new Set(plannedItems.map((item) => item.analysisPickId));

  const groupedSides = new Map<string, Set<string>>();
  for (const item of picks) {
    const key = conflictKey(item);
    const sides = groupedSides.get(key) ?? new Set<string>();
    sides.add(item.side);
    groupedSides.set(key, sides);
  }

  const recommendations = picks.map((item) => {
    const strategies = item.strategyForwardSignals.map(strategySupport);
    const conflict = (groupedSides.get(conflictKey(item))?.size ?? 0) > 1;
    const evaluation = evaluateDailyRecommendation({
      id: item.id,
      matchId: item.matchId,
      kickoffAt: item.match.kickoffAt,
      status: item.status,
      source: item.source,
      odds: item.odds,
      modelProbability: item.modelProbability,
      expectedValue: item.expectedValue,
      modelSample: item.modelSample,
      modelCoverage: item.modelCoverage,
      modelConfidence: item.modelConfidence,
      marketStatus: item.marketStatus,
      evidenceStatus: item.evidenceStatus,
      backtestSignals: item.backtestSignals,
      backtestHitRate: item.backtestHitRate,
      edgeBacktestSignals: item.edgeBacktestSignals,
      edgeBacktestHitRate: item.edgeBacktestHitRate,
      conflict,
      strategies,
    });

    return {
      item,
      strategies,
      conflict,
      evaluation,
    };
  }).sort((left, right) => {
    const playedDifference = Number(left.item.status === "PLAYED") - Number(right.item.status === "PLAYED");
    if (playedDifference !== 0) return playedDifference;
    const priorityDifference = priorityRank(left.evaluation.priority) - priorityRank(right.evaluation.priority);
    if (priorityDifference !== 0) return priorityDifference;
    const scoreDifference = right.evaluation.score - left.evaluation.score;
    if (scoreDifference !== 0) return scoreDifference;
    const kickoffDifference = left.item.match.kickoffAt.getTime() - right.item.match.kickoffAt.getTime();
    return kickoffDifference !== 0 ? kickoffDifference : left.item.id.localeCompare(right.item.id);
  });

  const visible = input.priority && input.priority !== "ALL"
    ? recommendations.filter((item) => item.evaluation.priority === input.priority)
    : recommendations;

  const leagues = Array.from(new Map(
    recommendations.map((item) => [
      item.item.match.season.league.id,
      item.item.match.season.league,
    ]),
  ).values()).sort((left, right) => left.name.localeCompare(right.name, "pl"));

  return {
    now,
    until,
    hours,
    recommendations: visible,
    allRecommendations: recommendations,
    leagues,
    plannedPickIds,
    summary: {
      total: recommendations.length,
      top: recommendations.filter((item) => item.evaluation.priority === "TOP").length,
      value: recommendations.filter((item) => item.evaluation.priority === "VALUE").length,
      watch: recommendations.filter((item) => item.evaluation.priority === "WATCH").length,
      blocked: recommendations.filter((item) => item.evaluation.priority === "BLOCKED").length,
      played: recommendations.filter((item) => item.item.status === "PLAYED").length,
      missingMarketData: recommendations.filter((item) => item.evaluation.missingMarketData).length,
      exposureWarnings: recommendations.filter((item) => item.evaluation.hasExposureWarning).length,
    },
  };
}

export type LoadedDailyRecommendations = Awaited<ReturnType<typeof loadDailyRecommendations>>;
export type LoadedDailyRecommendation = LoadedDailyRecommendations["recommendations"][number];
export type LoadedDailyRecommendationEvaluation = DailyRecommendationEvaluation;
