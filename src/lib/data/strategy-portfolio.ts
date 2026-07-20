import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type {
  StrategyConfig,
  StrategyHistoricalSnapshot,
} from "@/lib/stats/strategy-lab";
import {
  summarizeForwardSignals,
  type ForwardSignalMetricEntry,
} from "@/lib/stats/strategy-forward";

function configFromJson(value: Prisma.JsonValue): StrategyConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || typeof item.decisionMode !== "string") return null;
  return item as unknown as StrategyConfig;
}

function historicalSnapshotFromJson(
  value: Prisma.JsonValue,
): StrategyHistoricalSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (
    typeof item.capturedAt !== "string"
    || typeof item.matchedEntries !== "number"
    || typeof item.trainingEntries !== "number"
    || typeof item.validationEntries !== "number"
    || typeof item.stability !== "string"
    || !item.metrics
    || !item.training
    || !item.validation
  ) return null;
  return item as unknown as StrategyHistoricalSnapshot;
}

function metricEntry(signal: {
  id: string;
  decisionAt: Date;
  kickoffAt: Date;
  oddsAtSignal: number | null;
  closingOdds: number | null;
  result: "WIN" | "LOSS" | "PUSH" | "VOID" | null;
  fixedStake: number;
  percentageStake: number;
  kellyStake: number | null;
  recommendedStake: number | null;
  exposureStatus: string;
}): ForwardSignalMetricEntry {
  return {
    id: signal.id,
    decisionAt: signal.decisionAt,
    kickoffAt: signal.kickoffAt,
    oddsAtSignal: signal.oddsAtSignal,
    closingOdds: signal.closingOdds,
    result: signal.result,
    fixedStake: signal.fixedStake,
    percentageStake: signal.percentageStake,
    kellyStake: signal.kellyStake,
    recommendedStake: signal.recommendedStake,
    exposureStatus: signal.exposureStatus,
  };
}

export async function loadStrategyPortfolio(input: {
  userId: string;
  selectedVersionId?: string | null;
}) {
  const versions = await prisma.analysisStrategyVersion.findMany({
    where: { userId: input.userId },
    include: {
      strategy: true,
      signals: {
        orderBy: [
          { kickoffAt: "desc" },
          { decisionAt: "desc" },
          { id: "desc" },
        ],
      },
    },
    orderBy: [
      { status: "asc" },
      { activatedAt: "desc" },
      { version: "desc" },
    ],
  });

  const loaded = versions.flatMap((version) => {
    const config = configFromJson(version.config);
    const historical = historicalSnapshotFromJson(version.historicalSnapshot);
    if (!config || !historical) return [];
    return [{
      version,
      config,
      historical,
      forward: summarizeForwardSignals(version.signals.map(metricEntry)),
    }];
  });

  const selected = loaded.find((item) => item.version.id === input.selectedVersionId)
    ?? loaded.find((item) => item.version.endedAt === null && item.version.status === "APPROVED")
    ?? loaded.find((item) => item.version.endedAt === null && item.version.status === "FORWARD_TEST")
    ?? loaded[0]
    ?? null;

  const runningSignals = loaded
    .filter((item) => item.version.endedAt === null)
    .flatMap((item) => item.version.signals.map(metricEntry));

  return {
    versions: loaded,
    selected,
    aggregate: summarizeForwardSignals(runningSignals),
  };
}

export type LoadedStrategyVersion = Awaited<ReturnType<typeof loadStrategyPortfolio>>["versions"][number];
