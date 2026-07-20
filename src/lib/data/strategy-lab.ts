import { prisma } from "@/lib/db";
import {
  evaluateStrategy,
  type StrategyConfig,
  type StrategyDecisionMode,
  type StrategyEntry,
  type StrategyEvaluation,
  type StrategyConfidence,
} from "@/lib/stats/strategy-lab";

export type StrategyRecord = Awaited<ReturnType<typeof loadStrategyRecords>>[number];

function loadStrategyRecords(userId: string) {
  return prisma.analysisStrategy.findMany({
    where: { userId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
  });
}

export function strategyConfigFromRecord(
  strategy: Omit<StrategyRecord, "versions">,
): StrategyConfig {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    active: strategy.active,
    leagueId: strategy.leagueId,
    seasonId: strategy.seasonId,
    statKey: strategy.statKey,
    scope: strategy.scope,
    target: strategy.target as StrategyConfig["target"],
    side: strategy.side as StrategyConfig["side"],
    source: strategy.source,
    modelVersion: strategy.modelVersion,
    marketStatus: strategy.marketStatus,
    evidenceStatus: strategy.evidenceStatus,
    bookmaker: strategy.bookmaker,
    decisionMode: strategy.decisionMode as StrategyDecisionMode,
    minModelProbability: strategy.minModelProbability,
    maxModelProbability: strategy.maxModelProbability,
    minExpectedValue: strategy.minExpectedValue,
    maxExpectedValue: strategy.maxExpectedValue,
    minOdds: strategy.minOdds,
    maxOdds: strategy.maxOdds,
    minThreshold: strategy.minThreshold,
    maxThreshold: strategy.maxThreshold,
    minEdge: strategy.minEdge,
    minModelSample: strategy.minModelSample,
    minCoverage: strategy.minCoverage,
    minBacktestSignals: strategy.minBacktestSignals,
    minBacktestHitRate: strategy.minBacktestHitRate,
    minimumConfidence: strategy.minimumConfidence as StrategyConfidence | null,
  };
}

export async function loadStrategyEntries(userId: string): Promise<StrategyEntry[]> {
  const items = await prisma.analysisPick.findMany({
    where: { userId },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          season: { include: { league: true } },
        },
      },
    },
    orderBy: [{ match: { kickoffAt: "asc" } }, { createdAt: "asc" }],
  });

  return items.map((item) => ({
    id: item.id,
    matchId: item.matchId,
    kickoffAt: item.match.kickoffAt,
    createdAt: item.createdAt,
    quoteCapturedAt: item.quoteCapturedAt,
    leagueId: item.match.season.league.id,
    leagueName: item.match.season.league.name,
    seasonId: item.match.season.id,
    seasonName: item.match.season.name,
    homeTeamName: item.match.homeTeam.name,
    awayTeamName: item.match.awayTeam.name,
    statKey: item.statKey,
    statLabel: item.statLabel,
    threshold: item.threshold,
    scope: item.scope,
    target: item.scope === "MATCH_TOTAL"
      ? "MATCH_TOTAL"
      : item.selectedTeamId === item.match.homeTeam.id
        ? "HOME_TEAM"
        : item.selectedTeamId === item.match.awayTeam.id
          ? "AWAY_TEAM"
          : "UNKNOWN",
    side: item.side,
    source: item.source,
    status: item.status,
    result: item.result,
    odds: item.odds,
    closingOdds: item.closingOdds,
    stake: item.stake,
    projection: item.projection,
    edge: item.edge,
    evidenceStatus: item.evidenceStatus,
    backtestSignals: item.backtestSignals,
    backtestHitRate: item.backtestHitRate,
    modelProbability: item.modelProbability,
    expectedValue: item.expectedValue,
    modelSample: item.modelSample,
    modelCoverage: item.modelCoverage,
    modelConfidence: item.modelConfidence,
    modelVersion: item.modelVersion,
    marketStatus: item.marketStatus,
    bookmaker: item.bookmaker,
  }));
}

export type LoadedStrategy = {
  strategy: StrategyRecord;
  config: StrategyConfig;
  evaluation: StrategyEvaluation;
};

export async function loadStrategyLab(input: {
  userId: string;
  selectedId?: string | null;
}) {
  const [strategies, entries, seasons, leagues] = await Promise.all([
    loadStrategyRecords(input.userId),
    loadStrategyEntries(input.userId),
    prisma.season.findMany({
      include: { league: true },
      orderBy: [{ startsAt: "desc" }, { league: { name: "asc" } }],
    }),
    prisma.league.findMany({ orderBy: { name: "asc" } }),
  ]);

  const evaluated: LoadedStrategy[] = strategies.map((strategy) => {
    const config = strategyConfigFromRecord(strategy);
    return {
      strategy,
      config,
      evaluation: evaluateStrategy(entries, config),
    };
  });
  const selected = evaluated.find((item) => item.strategy.id === input.selectedId)
    ?? evaluated.find((item) => item.strategy.active)
    ?? evaluated[0]
    ?? null;

  return {
    entries,
    strategies: evaluated,
    selected,
    seasons,
    leagues,
  };
}

export async function loadStrategyEvaluation(input: {
  userId: string;
  strategyId: string;
}) {
  const strategy = await prisma.analysisStrategy.findFirst({
    where: { id: input.strategyId, userId: input.userId },
  });
  if (!strategy) return null;
  const entries = await loadStrategyEntries(input.userId);
  const config = strategyConfigFromRecord(strategy);
  return {
    strategy,
    config,
    evaluation: evaluateStrategy(entries, config),
  };
}
