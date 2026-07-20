import type { Prisma } from "@/generated/prisma/client";
import { loadStrategyPortfolio, type LoadedStrategyVersion } from "@/lib/data/strategy-portfolio";
import { prisma } from "@/lib/db";
import {
  evaluateStrategyHealth,
  type StrategyHealthEvaluation,
  type StrategyHealthMetricSet,
} from "@/lib/stats/strategy-monitoring";

function historicalMetrics(item: LoadedStrategyVersion): StrategyHealthMetricSet {
  const metrics = item.historical.validation;
  return {
    resolvedEntries: metrics.resolvedEntries,
    wins: metrics.wins,
    losses: metrics.losses,
    hitRate: metrics.hitRate,
    roi: metrics.roi,
    averageClv: metrics.averageClv,
    maxDrawdown: metrics.maxDrawdown,
    profit: metrics.profit,
    turnover: metrics.turnover,
    financialEntries: metrics.financialEntries,
  };
}

function forwardMetrics(item: LoadedStrategyVersion): StrategyHealthMetricSet {
  return {
    resolvedEntries: item.forward.resolvedSignals,
    wins: item.forward.wins,
    losses: item.forward.losses,
    hitRate: item.forward.hitRate,
    roi: item.forward.selected.roi,
    averageClv: item.forward.averageClv,
    maxDrawdown: item.forward.selected.maxDrawdown,
    profit: item.forward.selected.profit,
    turnover: item.forward.selected.turnover,
    financialEntries: item.forward.selected.financialEntries,
  };
}

export function evaluateLoadedStrategyHealth(
  item: LoadedStrategyVersion,
): StrategyHealthEvaluation {
  return evaluateStrategyHealth({
    historical: historicalMetrics(item),
    forward: forwardMetrics(item),
    initialBankroll: item.version.initialBankroll,
    exposureWarnings: item.forward.exposureWarnings,
    settings: {
      minForwardSample: item.version.minForwardSample,
      maxDrawdownPercent: item.version.maxDrawdownPercent,
      maxLossPercent: item.version.maxLossPercent,
    },
  });
}

function healthRank(status: string) {
  if (status === "STOPPED") return 0;
  if (status === "AT_RISK") return 1;
  if (status === "WATCH") return 2;
  if (status === "INSUFFICIENT_DATA") return 3;
  return 4;
}

export async function loadStrategyMonitoring(input: {
  userId: string;
  selectedVersionId?: string | null;
}) {
  const portfolio = await loadStrategyPortfolio(input);
  const versions = portfolio.versions
    .map((item) => ({
      ...item,
      health: evaluateLoadedStrategyHealth(item),
    }))
    .sort((left, right) => {
      const activeDifference = Number(right.version.endedAt === null) - Number(left.version.endedAt === null);
      if (activeDifference !== 0) return activeDifference;
      const healthDifference = healthRank(left.health.status) - healthRank(right.health.status);
      if (healthDifference !== 0) return healthDifference;
      const scoreDifference = (right.health.score ?? -1) - (left.health.score ?? -1);
      if (scoreDifference !== 0) return scoreDifference;
      return right.version.activatedAt.getTime() - left.version.activatedAt.getTime();
    });

  const selected = versions.find((item) => item.version.id === input.selectedVersionId)
    ?? versions.find((item) => item.version.endedAt === null && item.health.status === "STOPPED")
    ?? versions.find((item) => item.version.endedAt === null && item.health.status === "AT_RISK")
    ?? versions.find((item) => item.version.endedAt === null)
    ?? versions[0]
    ?? null;

  const events = selected
    ? await prisma.strategyHealthEvent.findMany({
        where: {
          userId: input.userId,
          strategyVersionId: selected.version.id,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 50,
      })
    : [];

  const activeVersions = versions.filter((item) => item.version.endedAt === null);

  return {
    versions,
    selected,
    events,
    summary: {
      total: versions.length,
      active: activeVersions.length,
      healthy: activeVersions.filter((item) => item.health.status === "HEALTHY").length,
      watch: activeVersions.filter((item) => item.health.status === "WATCH").length,
      atRisk: activeVersions.filter((item) => item.health.status === "AT_RISK").length,
      stopped: activeVersions.filter((item) => item.health.status === "STOPPED").length,
      insufficient: activeVersions.filter((item) => item.health.status === "INSUFFICIENT_DATA").length,
    },
  };
}

export async function evaluateAndPersistStrategyHealth(input: {
  userId: string;
  versionId?: string | null;
  source: "SYNC" | "MANUAL" | "STATUS_CHANGE";
}) {
  const portfolio = await loadStrategyPortfolio({
    userId: input.userId,
    selectedVersionId: input.versionId,
  });
  const items = input.versionId
    ? portfolio.versions.filter((item) => item.version.id === input.versionId)
    : portfolio.versions.filter((item) => item.version.endedAt === null);

  let evaluated = 0;
  let changed = 0;

  for (const item of items) {
    const health = evaluateLoadedStrategyHealth(item);
    const reason = health.reason || null;
    const statusChanged = item.version.healthStatus !== health.status;
    const scoreChanged = item.version.healthScore !== health.score;
    const reasonChanged = item.version.healthReason !== reason;
    const evaluatedAt = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.analysisStrategyVersion.update({
        where: { id: item.version.id },
        data: {
          healthStatus: health.status,
          healthScore: health.score,
          healthReason: reason,
          healthEvaluatedAt: evaluatedAt,
        },
      });

      if (statusChanged || scoreChanged || reasonChanged) {
        await tx.strategyHealthEvent.create({
          data: {
            strategyVersionId: item.version.id,
            userId: input.userId,
            status: health.status,
            score: health.score,
            reason,
            source: input.source,
            metrics: {
              evaluatedAt: evaluatedAt.toISOString(),
              sampleProgress: health.sampleProgress,
              confidence: health.confidence,
              roiDelta: health.roiDelta,
              clvDelta: health.clvDelta,
              hitRateDelta: health.hitRateDelta,
              drawdownPercent: health.drawdownPercent,
              lossPercent: health.lossPercent,
              hardStop: health.hardStop,
              forwardHitRateInterval: health.forwardHitRateInterval,
              historicalHitRateInterval: health.historicalHitRateInterval,
            } as unknown as Prisma.InputJsonValue,
          },
        });
      }
    });

    evaluated += 1;
    if (statusChanged || scoreChanged || reasonChanged) changed += 1;
  }

  return { evaluated, changed };
}

export type LoadedStrategyMonitoring = Awaited<ReturnType<typeof loadStrategyMonitoring>>;
export type LoadedMonitoredStrategyVersion = LoadedStrategyMonitoring["versions"][number];
