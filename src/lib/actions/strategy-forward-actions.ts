"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { AuditEntityType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { evaluateAndPersistStrategyHealth } from "@/lib/data/strategy-monitoring";
import { loadStrategyEntries } from "@/lib/data/strategy-lab";
import { syncActiveForwardSignals } from "@/lib/data/strategy-forward";
import { prisma } from "@/lib/db";
import {
  evaluateStrategy,
  snapshotStrategyEvaluation,
  type StrategyConfig,
} from "@/lib/stats/strategy-lab";
import { valueToString } from "@/lib/utils";

const stakeModes = new Set(["FIXED", "BANKROLL_PERCENT", "KELLY"]);
const runningStatuses = new Set(["FORWARD_TEST", "APPROVED"]);

class StrategyActivationConflict extends Error {}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberField(
  formData: FormData,
  name: string,
  input: { min: number; max: number; defaultValue: number },
) {
  const raw = text(formData, name);
  if (!raw) return input.defaultValue;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < input.min || value > input.max) {
    throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  }
  return value;
}

function strategySnapshot(strategy: {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  leagueId: string | null;
  seasonId: string | null;
  statKey: string | null;
  scope: string | null;
  target: string | null;
  side: string | null;
  source: string | null;
  modelVersion: string | null;
  marketStatus: string | null;
  evidenceStatus: string | null;
  bookmaker: string | null;
  decisionMode: string;
  minModelProbability: number | null;
  maxModelProbability: number | null;
  minExpectedValue: number | null;
  maxExpectedValue: number | null;
  minOdds: number | null;
  maxOdds: number | null;
  minThreshold: number | null;
  maxThreshold: number | null;
  minEdge: number | null;
  minModelSample: number | null;
  minCoverage: number | null;
  minBacktestSignals: number | null;
  minBacktestHitRate: number | null;
  minimumConfidence: string | null;
}) {
  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    active: strategy.active,
    leagueId: strategy.leagueId,
    seasonId: strategy.seasonId,
    statKey: strategy.statKey,
    scope: strategy.scope,
    target: strategy.target,
    side: strategy.side,
    source: strategy.source,
    modelVersion: strategy.modelVersion,
    marketStatus: strategy.marketStatus,
    evidenceStatus: strategy.evidenceStatus,
    bookmaker: strategy.bookmaker,
    decisionMode: strategy.decisionMode,
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
    minimumConfidence: strategy.minimumConfidence,
  };
}

function revalidateStrategyPaths() {
  revalidatePath("/strategies");
  revalidatePath("/portfolio");
  revalidatePath("/journal");
  revalidatePath("/scanner");
  revalidatePath("/monitoring");
}

export async function activateStrategyForwardAction(formData: FormData) {
  const user = await requireUser();
  const strategyId = text(formData, "strategyId");
  if (!strategyId) redirect("/strategies?error=missing");

  const stakeModeRaw = text(formData, "stakeMode") || "FIXED";
  if (!stakeModes.has(stakeModeRaw)) redirect(`/strategies?strategyId=${strategyId}&error=settings`);

  const settings = {
    stakeMode: stakeModeRaw,
    fixedStake: numberField(formData, "fixedStake", { min: 0.01, max: 1000000, defaultValue: 10 }),
    initialBankroll: numberField(formData, "initialBankroll", { min: 1, max: 100000000, defaultValue: 1000 }),
    bankrollPercent: numberField(formData, "bankrollPercent", { min: 0.01, max: 100, defaultValue: 1 }),
    kellyFraction: numberField(formData, "kellyFraction", { min: 0.01, max: 1, defaultValue: 0.25 }),
    maxStakePercent: numberField(formData, "maxStakePercent", { min: 0.01, max: 100, defaultValue: 3 }),
    maxMatchExposurePercent: numberField(formData, "maxMatchExposurePercent", { min: 0.01, max: 100, defaultValue: 5 }),
    maxLeagueExposurePercent: numberField(formData, "maxLeagueExposurePercent", { min: 0.01, max: 100, defaultValue: 15 }),
    maxMarketExposurePercent: numberField(formData, "maxMarketExposurePercent", { min: 0.01, max: 100, defaultValue: 15 }),
    maxDailyExposurePercent: numberField(formData, "maxDailyExposurePercent", { min: 0.01, max: 100, defaultValue: 20 }),
  };

  const strategy = await prisma.analysisStrategy.findFirst({
    where: { id: strategyId, userId: user.id },
  });
  if (!strategy) redirect("/strategies?error=missing");
  if (strategy.status !== "HISTORICAL_VALIDATED") {
    redirect(`/strategies?strategyId=${strategyId}&error=notValidated`);
  }

  const activatedAt = new Date();
  const config = strategySnapshot(strategy) as StrategyConfig;
  const historicalEntries = (await loadStrategyEntries(user.id)).filter(
    (entry) =>
      entry.createdAt.getTime() <= activatedAt.getTime()
      && entry.kickoffAt.getTime() < activatedAt.getTime(),
  );
  const historicalSnapshot = snapshotStrategyEvaluation(
    evaluateStrategy(historicalEntries, config, activatedAt),
    activatedAt,
  );
  let version: { id: string };

  try {
    version = await prisma.$transaction(async (tx) => {
      const claimed = await tx.analysisStrategy.updateMany({
        where: {
          id: strategyId,
          userId: user.id,
          status: "HISTORICAL_VALIDATED",
        },
        data: { active: true, status: "FORWARD_TEST" },
      });
      if (claimed.count !== 1) throw new StrategyActivationConflict();

      const aggregate = await tx.analysisStrategyVersion.aggregate({
        where: { strategyId },
        _max: { version: true },
      });
      const versionNumber = (aggregate._max.version ?? 0) + 1;
      const created = await tx.analysisStrategyVersion.create({
        data: {
          strategyId,
          userId: user.id,
          version: versionNumber,
          status: "FORWARD_TEST",
          activatedAt,
          config: config as Prisma.InputJsonValue,
          historicalSnapshot: historicalSnapshot as unknown as Prisma.InputJsonValue,
          ...settings,
        },
      });
      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.ANALYSIS_STRATEGY,
          entityId: strategyId,
          action: "ACTIVATE_STRATEGY_FORWARD_VERSION",
          userId: user.id,
          changes: {
            create: [
              { fieldName: "version", oldValue: null, newValue: String(versionNumber) },
              { fieldName: "activatedAt", oldValue: null, newValue: activatedAt.toISOString() },
              { fieldName: "stakeMode", oldValue: null, newValue: settings.stakeMode },
            ],
          },
        },
      });
      return created;
    });
  } catch (error) {
    if (error instanceof StrategyActivationConflict || databaseErrorCode(error) === "P2002") {
      const running = await prisma.analysisStrategyVersion.findFirst({
        where: {
          strategyId,
          userId: user.id,
          status: { in: [...runningStatuses] },
          endedAt: null,
        },
        orderBy: { version: "desc" },
      });
      redirect(running
        ? `/portfolio?versionId=${running.id}&already=1`
        : `/strategies?strategyId=${strategyId}&error=notValidated`);
    }
    throw error;
  }

  revalidateStrategyPaths();
  redirect(`/portfolio?versionId=${version.id}&activated=1`);
}

export async function approveStrategyForwardAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  const version = await prisma.analysisStrategyVersion.findFirst({
    where: { id: versionId, userId: user.id },
  });
  if (!version) redirect("/portfolio?error=missing");
  if (version.endedAt) redirect(`/portfolio?versionId=${versionId}&error=ended`);
  if (version.status !== "FORWARD_TEST") {
    redirect(`/portfolio?versionId=${versionId}&error=invalidStatus`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategyVersion.update({
      where: { id: versionId },
      data: { status: "APPROVED" },
    });
    await tx.analysisStrategy.update({
      where: { id: version.strategyId },
      data: { active: true, status: "APPROVED" },
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: version.strategyId,
        action: "APPROVE_STRATEGY_FORWARD_VERSION",
        userId: user.id,
        changes: {
          create: [{ fieldName: "status", oldValue: version.status, newValue: "APPROVED" }],
        },
      },
    });
  });

  revalidateStrategyPaths();
  redirect(`/portfolio?versionId=${versionId}&approved=1`);
}

export async function pauseStrategyForwardAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  const version = await prisma.analysisStrategyVersion.findFirst({
    where: { id: versionId, userId: user.id },
  });
  if (!version) redirect("/portfolio?error=missing");
  if (version.endedAt) redirect(`/portfolio?versionId=${versionId}&already=1`);
  if (!runningStatuses.has(version.status)) {
    redirect(`/portfolio?versionId=${versionId}&error=invalidStatus`);
  }
  const endedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategyVersion.update({
      where: { id: versionId },
      data: { status: "PAUSED", endedAt },
    });
    await tx.analysisStrategy.update({
      where: { id: version.strategyId },
      data: { active: false, status: "PAUSED" },
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: version.strategyId,
        action: "PAUSE_STRATEGY_FORWARD_VERSION",
        userId: user.id,
        changes: {
          create: [
            { fieldName: "status", oldValue: version.status, newValue: "PAUSED" },
            { fieldName: "endedAt", oldValue: valueToString(version.endedAt), newValue: endedAt.toISOString() },
          ],
        },
      },
    });
  });

  revalidateStrategyPaths();
  redirect(`/portfolio?versionId=${versionId}&paused=1`);
}

export async function archiveStrategyVersionAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  const version = await prisma.analysisStrategyVersion.findFirst({
    where: { id: versionId, userId: user.id },
  });
  if (!version) redirect("/portfolio?error=missing");
  if (version.status === "ARCHIVED") {
    redirect(`/portfolio?versionId=${versionId}&already=1`);
  }
  const endedAt = version.endedAt ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategyVersion.update({
      where: { id: versionId },
      data: { status: "ARCHIVED", endedAt },
    });
    const activeVersion = await tx.analysisStrategyVersion.findFirst({
      where: {
        strategyId: version.strategyId,
        id: { not: versionId },
        endedAt: null,
        status: { in: [...runningStatuses] },
      },
      select: { id: true },
    });
    if (!activeVersion) {
      await tx.analysisStrategy.update({
        where: { id: version.strategyId },
        data: { active: false, status: "ARCHIVED" },
      });
    }
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: version.strategyId,
        action: "ARCHIVE_STRATEGY_FORWARD_VERSION",
        userId: user.id,
        changes: {
          create: [{ fieldName: "status", oldValue: version.status, newValue: "ARCHIVED" }],
        },
      },
    });
  });

  revalidateStrategyPaths();
  redirect(`/portfolio?versionId=${versionId}&archived=1`);
}

export async function prepareNewStrategyVersionAction(formData: FormData) {
  const user = await requireUser();
  const strategyId = text(formData, "strategyId");
  const strategy = await prisma.analysisStrategy.findFirst({
    where: { id: strategyId, userId: user.id },
  });
  if (!strategy) redirect("/strategies?error=missing");
  const endedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategyVersion.updateMany({
      where: {
        strategyId,
        userId: user.id,
        status: { in: [...runningStatuses] },
        endedAt: null,
      },
      data: { status: "PAUSED", endedAt },
    });
    await tx.analysisStrategy.update({
      where: { id: strategyId },
      data: { active: false, status: "DRAFT" },
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: strategyId,
        action: "PREPARE_NEW_STRATEGY_VERSION",
        userId: user.id,
        changes: {
          create: [{ fieldName: "status", oldValue: strategy.status, newValue: "DRAFT" }],
        },
      },
    });
  });

  revalidateStrategyPaths();
  redirect(`/strategies?strategyId=${strategyId}&edit=1&newVersion=1#editor`);
}

export async function markStrategyHistoricallyValidatedAction(formData: FormData) {
  const user = await requireUser();
  const strategyId = text(formData, "strategyId");
  const strategy = await prisma.analysisStrategy.findFirst({
    where: { id: strategyId, userId: user.id },
  });
  if (!strategy) redirect("/strategies?error=missing");
  if (runningStatuses.has(strategy.status)) {
    redirect(`/strategies?strategyId=${strategyId}&error=locked`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategy.update({
      where: { id: strategyId },
      data: { active: false, status: "HISTORICAL_VALIDATED" },
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: strategyId,
        action: "MARK_STRATEGY_HISTORICALLY_VALIDATED",
        userId: user.id,
        changes: {
          create: [{
            fieldName: "status",
            oldValue: strategy.status,
            newValue: "HISTORICAL_VALIDATED",
          }],
        },
      },
    });
  });
  revalidateStrategyPaths();
  redirect(`/strategies?strategyId=${strategyId}&validated=1`);
}

export async function syncStrategyForwardSignalsAction(formData: FormData) {
  const user = await requireUser();
  const versionId = text(formData, "versionId");
  const captured = await syncActiveForwardSignals(user.id);
  await evaluateAndPersistStrategyHealth({
    userId: user.id,
    source: "SYNC",
  });
  revalidateStrategyPaths();
  redirect(`/portfolio${versionId ? `?versionId=${versionId}&` : "?"}synced=${captured}`);
}
