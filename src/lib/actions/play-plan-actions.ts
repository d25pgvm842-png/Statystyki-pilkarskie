"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import {
  AnalysisPickStatus,
  AuditEntityType,
} from "@/generated/prisma/enums";
import { requireWriteUser } from "@/lib/auth";
import {
  loadDailyPlayPlanEvaluation,
  playPlanDateFromKey,
  playPlanSnapshotFromJson,
  warsawDateKey,
} from "@/lib/data/play-plan";
import { loadDailyRecommendations } from "@/lib/data/daily-recommendations";
import { syncForwardSignalsForPick } from "@/lib/data/strategy-forward";
import { prisma } from "@/lib/db";
import { lockTransactionResource } from "@/lib/transaction-locks";
import type { PlayPlanRecommendationSnapshot } from "@/lib/stats/play-plan";
import { valueToString } from "@/lib/utils";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function optionalText(formData: FormData, name: string, maxLength: number) {
  const value = text(formData, name);
  if (value.length > maxLength) throw new Error(`${name} przekracza limit ${maxLength} znaków.`);
  return value || null;
}

function requiredNumber(
  formData: FormData,
  name: string,
  minimum: number,
  maximum: number,
) {
  const value = Number(text(formData, name).replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  }
  return value;
}

function optionalNumber(
  formData: FormData,
  name: string,
  minimum: number,
  maximum: number,
) {
  const raw = text(formData, name);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  }
  return value;
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

function revalidatePlayPlanPaths() {
  revalidatePath("/play-plan");
  revalidatePath("/recommendations");
  revalidatePath("/journal");
  revalidatePath("/portfolio");
  revalidatePath("/monitoring");
}

function planPath(dateKey: string, suffix = "") {
  return `/play-plan?date=${encodeURIComponent(dateKey)}${suffix}`;
}

function recommendationSnapshot(
  recommendation: Awaited<ReturnType<typeof loadDailyRecommendations>>["allRecommendations"][number],
  capturedAt: Date,
): PlayPlanRecommendationSnapshot {
  const { item, evaluation } = recommendation;
  return {
    capturedAt: capturedAt.toISOString(),
    matchId: item.matchId,
    kickoffAt: item.match.kickoffAt.toISOString(),
    leagueId: item.match.season.league.id,
    leagueName: item.match.season.league.name,
    seasonName: item.match.season.name,
    homeTeamName: item.match.homeTeam.name,
    awayTeamName: item.match.awayTeam.name,
    statKey: item.statKey,
    statLabel: item.statLabel,
    scope: item.scope,
    target: item.selectedTeamId ?? "MATCH",
    side: item.side,
    threshold: item.threshold,
    source: item.source,
    recommendationPriority: evaluation.priority,
    recommendationScore: evaluation.score,
    expectedValue: item.expectedValue,
    modelProbability: item.modelProbability,
    fairOdds: item.fairOdds,
    marketStatus: item.marketStatus,
    evidenceStatus: item.evidenceStatus,
    bestStrategy: evaluation.bestStrategy ? {
      strategyVersionId: evaluation.bestStrategy.strategyVersionId,
      strategyName: evaluation.bestStrategy.strategyName,
      version: evaluation.bestStrategy.version,
      healthStatus: evaluation.bestStrategy.healthStatus,
      healthScore: evaluation.bestStrategy.healthScore,
      exposureStatus: evaluation.bestStrategy.exposureStatus,
      recommendedStake: evaluation.bestStrategy.recommendedStake,
      stakeMode: evaluation.bestStrategy.stakeMode,
    } : null,
    reasons: evaluation.reasons,
    warnings: evaluation.warnings,
    blockers: evaluation.blockers,
  };
}

export async function addRecommendationToPlayPlanAction(formData: FormData) {
  const user = await requireWriteUser();
  const pickId = text(formData, "pickId");
  if (!pickId) redirect("/recommendations?error=missing");

  const now = new Date();
  const loaded = await loadDailyRecommendations({ userId: user.id, now, hours: 168 });
  const recommendation = loaded.allRecommendations.find((entry) => entry.item.id === pickId);
  if (!recommendation) redirect("/recommendations?error=unavailable");
  if (recommendation.item.status !== AnalysisPickStatus.WATCHING) {
    redirect("/recommendations?error=alreadyPlayed");
  }
  if (recommendation.evaluation.priority === "BLOCKED") {
    redirect("/recommendations?error=blocked");
  }

  const dateKey = warsawDateKey(recommendation.item.match.kickoffAt);
  const planDate = playPlanDateFromKey(dateKey) as Date;
  const snapshot = recommendationSnapshot(recommendation, now);
  const defaultStake = recommendation.evaluation.bestStrategy?.recommendedStake ?? null;

  try {
    await prisma.$transaction(async (tx) => {
      const plan = await tx.dailyPlayPlan.upsert({
        where: { userId_planDate: { userId: user.id, planDate } },
        update: {},
        create: { userId: user.id, planDate },
      });
      await lockTransactionResource(tx, "daily-play-plan", plan.id);
      const current = await tx.dailyPlayPlan.findFirst({
        where: { id: plan.id, userId: user.id },
        select: { id: true, status: true },
      });
      if (!current || current.status !== "DRAFT") throw new Error("PLAN_LOCKED");

      const created = await tx.dailyPlayPlanItem.create({
        data: {
          planId: current.id,
          analysisPickId: pickId,
          priority: snapshot.recommendationPriority,
          score: snapshot.recommendationScore,
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          plannedStake: defaultStake,
          oddsSnapshot: recommendation.item.odds,
          bookmakerSnapshot: recommendation.item.bookmaker,
        },
      });
      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: current.id,
          userId: user.id,
          type: "ADD_ITEM",
          details: {
            itemId: created.id,
            analysisPickId: pickId,
            priority: snapshot.recommendationPriority,
            score: snapshot.recommendationScore,
            capturedAt: snapshot.capturedAt,
          },
        },
      });
    });
  } catch (error) {
    if (databaseErrorCode(error) === "P2002") redirect(planPath(dateKey, "&already=1"));
    if (error instanceof Error && error.message === "PLAN_LOCKED") {
      redirect(planPath(dateKey, "&error=locked"));
    }
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&added=1"));
}


export async function updatePlayPlanSettingsAction(formData: FormData) {
  const user = await requireWriteUser();
  const planId = text(formData, "planId");
  const next = {
    bankroll: requiredNumber(formData, "bankroll", 1, 100000000),
    maxDailyStakePercent: requiredNumber(formData, "maxDailyStakePercent", 0.01, 100),
    maxMatchStakePercent: requiredNumber(formData, "maxMatchStakePercent", 0.01, 100),
    maxLeagueStakePercent: requiredNumber(formData, "maxLeagueStakePercent", 0.01, 100),
    maxMarketStakePercent: requiredNumber(formData, "maxMarketStakePercent", 0.01, 100),
    note: optionalText(formData, "note", 2000),
  };

  let dateKey = "";
  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", planId);
      const plan = await tx.dailyPlayPlan.findFirst({ where: { id: planId, userId: user.id } });
      if (!plan) throw new Error("PLAN_MISSING");
      dateKey = plan.planDate.toISOString().slice(0, 10);
      if (plan.status !== "DRAFT") throw new Error("PLAN_LOCKED");

      await tx.dailyPlayPlan.update({ where: { id: plan.id }, data: next });
      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: plan.id,
          userId: user.id,
          type: "UPDATE_SETTINGS",
          details: {
            previous: {
              bankroll: plan.bankroll,
              maxDailyStakePercent: plan.maxDailyStakePercent,
              maxMatchStakePercent: plan.maxMatchStakePercent,
              maxLeagueStakePercent: plan.maxLeagueStakePercent,
              maxMarketStakePercent: plan.maxMarketStakePercent,
              note: plan.note,
            },
            next,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_MISSING") redirect("/play-plan?error=missing");
    if (error instanceof Error && error.message === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&settings=1"));
}


export async function updatePlayPlanItemAction(formData: FormData) {
  const user = await requireWriteUser();
  const itemId = text(formData, "itemId");
  const initial = await prisma.dailyPlayPlanItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { planId: true },
  });
  if (!initial) redirect("/play-plan?error=missing");

  const next = {
    plannedStake: optionalNumber(formData, "plannedStake", 0.01, 10000000),
    oddsSnapshot: optionalNumber(formData, "oddsSnapshot", 1.01, 1000),
    bookmakerSnapshot: optionalText(formData, "bookmakerSnapshot", 120),
    reason: optionalText(formData, "reason", 1000),
  };

  let dateKey = "";
  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", initial.planId);
      const item = await tx.dailyPlayPlanItem.findFirst({
        where: { id: itemId, plan: { userId: user.id } },
        include: { plan: true },
      });
      if (!item) throw new Error("ITEM_MISSING");
      dateKey = item.plan.planDate.toISOString().slice(0, 10);
      if (item.plan.status !== "DRAFT" || item.status === "PLAYED") throw new Error("PLAN_LOCKED");

      await tx.dailyPlayPlanItem.update({ where: { id: item.id }, data: next });
      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: item.planId,
          userId: user.id,
          type: "UPDATE_ITEM",
          details: {
            itemId: item.id,
            previous: {
              plannedStake: item.plannedStake,
              oddsSnapshot: item.oddsSnapshot,
              bookmakerSnapshot: item.bookmakerSnapshot,
              reason: item.reason,
            },
            next,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_MISSING") redirect("/play-plan?error=missing");
    if (error instanceof Error && error.message === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&itemUpdated=1"));
}


export async function removePlayPlanItemAction(formData: FormData) {
  const user = await requireWriteUser();
  const itemId = text(formData, "itemId");
  const initial = await prisma.dailyPlayPlanItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { planId: true },
  });
  if (!initial) redirect("/play-plan?error=missing");

  let dateKey = "";
  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", initial.planId);
      const item = await tx.dailyPlayPlanItem.findFirst({
        where: { id: itemId, plan: { userId: user.id } },
        include: { plan: true },
      });
      if (!item) throw new Error("ITEM_MISSING");
      dateKey = item.plan.planDate.toISOString().slice(0, 10);
      if (item.plan.status !== "DRAFT" || item.status === "PLAYED") throw new Error("PLAN_LOCKED");

      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: item.planId,
          userId: user.id,
          type: "REMOVE_ITEM",
          details: { itemId: item.id, analysisPickId: item.analysisPickId },
        },
      });
      await tx.dailyPlayPlanItem.delete({ where: { id: item.id } });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ITEM_MISSING") redirect("/play-plan?error=missing");
    if (error instanceof Error && error.message === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&removed=1"));
}


export async function approvePlayPlanAction(formData: FormData) {
  const user = await requireWriteUser();
  const planId = text(formData, "planId");
  let dateKey = "";

  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", planId);
      const current = await tx.dailyPlayPlan.findFirst({ where: { id: planId, userId: user.id } });
      if (!current) throw new Error("PLAN_MISSING");
      dateKey = current.planDate.toISOString().slice(0, 10);
      if (current.status !== "DRAFT") throw new Error("PLAN_LOCKED");

      const loaded = await loadDailyPlayPlanEvaluation(tx, {
        userId: user.id,
        planDate: current.planDate,
        now: new Date(),
      });
      if (!loaded || !loaded.evaluation.approvable) throw new Error("PLAN_BLOCKED");
      const approvedAt = new Date();

      await tx.dailyPlayPlan.update({
        where: { id: current.id },
        data: { status: "APPROVED", approvedAt },
      });
      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: current.id,
          userId: user.id,
          type: "APPROVE",
          details: {
            approvedAt: approvedAt.toISOString(),
            items: loaded.evaluation.items,
            totalStake: loaded.evaluation.totalStake,
            stakePercent: loaded.evaluation.stakePercent,
            weightedExpectedValue: loaded.evaluation.weightedExpectedValue,
            expectedProfit: loaded.evaluation.expectedProfit,
          },
        },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_MISSING") redirect("/play-plan?error=missing");
    if (error instanceof Error && error.message === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    if (error instanceof Error && error.message === "PLAN_BLOCKED") redirect(planPath(dateKey, "&error=blocked"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&approved=1"));
}


export async function reopenPlayPlanAction(formData: FormData) {
  const user = await requireWriteUser();
  const planId = text(formData, "planId");
  let dateKey = "";

  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", planId);
      const plan = await tx.dailyPlayPlan.findFirst({
        where: { id: planId, userId: user.id },
        include: { items: { select: { status: true } } },
      });
      if (!plan) throw new Error("PLAN_MISSING");
      dateKey = plan.planDate.toISOString().slice(0, 10);
      if (plan.status !== "APPROVED") throw new Error("PLAN_LOCKED");
      if (plan.items.some((item) => item.status === "PLAYED")) throw new Error("PLAN_PLAYED");

      await tx.dailyPlayPlan.update({
        where: { id: plan.id },
        data: { status: "DRAFT", approvedAt: null },
      });
      await tx.dailyPlayPlanEvent.create({
        data: { planId: plan.id, userId: user.id, type: "REOPEN", details: {} },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_MISSING") redirect("/play-plan?error=missing");
    if (error instanceof Error && error.message === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    if (error instanceof Error && error.message === "PLAN_PLAYED") redirect(planPath(dateKey, "&error=played"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&reopened=1"));
}


export async function archivePlayPlanAction(formData: FormData) {
  const user = await requireWriteUser();
  const planId = text(formData, "planId");
  let dateKey = "";
  let already = false;

  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", planId);
      const plan = await tx.dailyPlayPlan.findFirst({ where: { id: planId, userId: user.id } });
      if (!plan) throw new Error("PLAN_MISSING");
      dateKey = plan.planDate.toISOString().slice(0, 10);
      if (plan.status === "ARCHIVED") {
        already = true;
        return;
      }

      await tx.dailyPlayPlan.update({ where: { id: plan.id }, data: { status: "ARCHIVED" } });
      await tx.dailyPlayPlanEvent.create({
        data: { planId: plan.id, userId: user.id, type: "ARCHIVE", details: {} },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PLAN_MISSING") redirect("/play-plan?error=missing");
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, already ? "&already=1" : "&archived=1"));
}


export async function markPlayPlanItemPlayedAction(formData: FormData) {
  const user = await requireWriteUser();
  const itemId = text(formData, "itemId");
  const initial = await prisma.dailyPlayPlanItem.findFirst({
    where: { id: itemId, plan: { userId: user.id } },
    select: { planId: true },
  });
  if (!initial) redirect("/play-plan?error=missing");

  let dateKey = "";
  try {
    await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "daily-play-plan", initial.planId);
      const item = await tx.dailyPlayPlanItem.findFirst({
        where: { id: itemId, plan: { userId: user.id } },
        include: { plan: true },
      });
      if (!item) throw new Error("ITEM_MISSING");
      dateKey = item.plan.planDate.toISOString().slice(0, 10);
      if (item.plan.status !== "APPROVED" || item.status === "PLAYED") throw new Error("PLAN_LOCKED");

      const snapshot = playPlanSnapshotFromJson(item.snapshot);
      if (!snapshot) throw new Error("INVALID_SNAPSHOT");
      const now = new Date();
      if (new Date(snapshot.kickoffAt).getTime() <= now.getTime()) throw new Error("MATCH_STARTED");
      if (!item.plannedStake || item.plannedStake <= 0 || !item.oddsSnapshot || item.oddsSnapshot <= 1) {
        throw new Error("MISSING_MARKET");
      }

      await lockTransactionResource(tx, "analysis-pick", item.analysisPickId);
      const pick = await tx.analysisPick.findFirst({
        where: { id: item.analysisPickId, userId: user.id },
      });
      if (!pick) throw new Error("PICK_MISSING");
      if (pick.status !== AnalysisPickStatus.WATCHING && pick.status !== AnalysisPickStatus.PLAYED) {
        throw new Error("PICK_STATUS");
      }

      let playedAt = pick.placedAt ?? now;
      if (pick.status === AnalysisPickStatus.WATCHING) {
        const next = {
          status: AnalysisPickStatus.PLAYED,
          odds: item.oddsSnapshot,
          bookmaker: item.bookmakerSnapshot,
          stake: item.plannedStake,
          placedAt: now,
          result: null,
          actualValue: null,
          settledAt: null,
        };
        await tx.analysisPick.update({ where: { id: pick.id }, data: next });
        playedAt = now;
        const changes = Object.entries(next).flatMap(([fieldName, newValue]) => {
          const oldValue = valueToString(pick[fieldName as keyof typeof pick]);
          const nextValue = valueToString(newValue);
          return oldValue === nextValue ? [] : [{ fieldName, oldValue, newValue: nextValue }];
        });
        await tx.auditLog.create({
          data: {
            entityType: AuditEntityType.ANALYSIS_PICK,
            entityId: pick.id,
            action: "PLAY_FROM_DAILY_PLAN",
            userId: user.id,
            changes: { create: changes },
          },
        });
        await syncForwardSignalsForPick(tx, { pickId: pick.id, userId: user.id });
      }

      await tx.dailyPlayPlanItem.update({
        where: { id: item.id },
        data: { status: "PLAYED", playedAt },
      });
      await tx.dailyPlayPlanEvent.create({
        data: {
          planId: item.planId,
          userId: user.id,
          type: "PLAY_ITEM",
          details: {
            itemId: item.id,
            analysisPickId: pick.id,
            stake: item.plannedStake,
            odds: item.oddsSnapshot,
            bookmaker: item.bookmakerSnapshot,
            playedAt: playedAt.toISOString(),
          },
        },
      });
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "ITEM_MISSING" || code === "PICK_MISSING") redirect("/play-plan?error=missing");
    if (code === "PLAN_LOCKED") redirect(planPath(dateKey, "&error=locked"));
    if (code === "INVALID_SNAPSHOT") redirect(planPath(dateKey, "&error=snapshot"));
    if (code === "MATCH_STARTED") redirect(planPath(dateKey, "&error=started"));
    if (code === "MISSING_MARKET") redirect(planPath(dateKey, "&error=missingMarket"));
    if (code === "PICK_STATUS") redirect(planPath(dateKey, "&error=pickStatus"));
    throw error;
  }

  revalidatePlayPlanPaths();
  redirect(planPath(dateKey, "&played=1"));
}
