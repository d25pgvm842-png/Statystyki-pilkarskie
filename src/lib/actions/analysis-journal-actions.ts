"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AnalysisPickResult,
  AnalysisPickSide,
  AnalysisPickSource,
  AnalysisPickStatus,
  AuditEntityType,
  LineScope,
  MatchStatus,
} from "@/generated/prisma/enums";
import { requireWriteUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lockTransactionResource } from "@/lib/transaction-locks";
import {
  captureForwardSignalsForPick,
  syncForwardSignalsForPick,
} from "@/lib/data/strategy-forward";
import {
  buildAnalysisPickFingerprint,
  settleTotalSelection,
} from "@/lib/stats/analysis-journal";
import {
  trendDefinition,
  type TrendStatKey,
} from "@/lib/stats/trends";
import { valueToString } from "@/lib/utils";
import { classifyDecisionTiming } from "@/lib/stats/decision-integrity";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string, maxLength: number) {
  const value = text(formData, key);
  if (value.length > maxLength) {
    throw new Error(`${key} przekracza limit ${maxLength} znaków.`);
  }
  return value || null;
}

function requiredNumber(
  formData: FormData,
  key: string,
  minimum: number,
  maximum: number,
) {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość pola ${key}.`);
  }
  return value;
}

function optionalNumber(
  formData: FormData,
  key: string,
  minimum: number,
  maximum: number,
) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość pola ${key}.`);
  }
  return value;
}

function optionalInteger(
  formData: FormData,
  key: string,
  minimum: number,
  maximum: number,
) {
  const value = optionalNumber(formData, key, minimum, maximum);
  return value === null ? null : Math.floor(value);
}

function safeReturnPath(formData: FormData) {
  const value = text(formData, "returnTo");
  if (value.startsWith("/scanner") || value.startsWith("/journal")) return value;
  return "/journal";
}

function appendResult(path: string, key: string, value = "1") {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

function analysisPickSide(value: string) {
  if (value === AnalysisPickSide.OVER) return AnalysisPickSide.OVER;
  if (value === AnalysisPickSide.UNDER) return AnalysisPickSide.UNDER;
  throw new Error("Nieprawidłowy kierunek.");
}

function analysisPickStatus(value: string) {
  if (value === AnalysisPickStatus.WATCHING) return AnalysisPickStatus.WATCHING;
  if (value === AnalysisPickStatus.PLAYED) return AnalysisPickStatus.PLAYED;
  if (value === AnalysisPickStatus.REJECTED) return AnalysisPickStatus.REJECTED;
  if (value === AnalysisPickStatus.SETTLED) return AnalysisPickStatus.SETTLED;
  if (value === AnalysisPickStatus.VOID) return AnalysisPickStatus.VOID;
  throw new Error("Nieprawidłowy status.");
}

function analysisPickResult(value: string) {
  if (value === AnalysisPickResult.WIN) return AnalysisPickResult.WIN;
  if (value === AnalysisPickResult.LOSS) return AnalysisPickResult.LOSS;
  if (value === AnalysisPickResult.PUSH) return AnalysisPickResult.PUSH;
  if (value === AnalysisPickResult.VOID) return AnalysisPickResult.VOID;
  throw new Error("Nieprawidłowy wynik.");
}

function auditChanges(
  previous: Record<string, unknown>,
  next: Record<string, unknown>,
) {
  return Object.keys(next)
    .filter((key) => valueToString(previous[key]) !== valueToString(next[key]))
    .map((key) => ({
      fieldName: key,
      oldValue: valueToString(previous[key]),
      newValue: valueToString(next[key]),
    }));
}

export async function addAnalysisPickAction(formData: FormData) {
  const user = await requireWriteUser();
  const matchId = text(formData, "matchId");
  const statKey = text(formData, "statKey");
  const definition = trendDefinition(statKey);
  if (!matchId || !definition) throw new Error("Brakuje meczu lub rynku.");

  const threshold = requiredNumber(formData, "threshold", 0, 500);
  const side = analysisPickSide(text(formData, "side"));
  const source = text(formData, "source") === AnalysisPickSource.SCANNER
    ? AnalysisPickSource.SCANNER
    : AnalysisPickSource.MANUAL;
  const returnTo = safeReturnPath(formData);

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true, kickoffAt: true },
  });
  if (!match) redirect(appendResult(returnTo, "error", "match"));
  if (
    match.status !== MatchStatus.SCHEDULED
    && match.status !== MatchStatus.LIVE
  ) {
    redirect(appendResult(returnTo, "error", "status"));
  }

  const fingerprint = buildAnalysisPickFingerprint({
    matchId,
    statKey,
    scope: LineScope.MATCH_TOTAL,
    threshold,
    side,
  });
  const existing = await prisma.analysisPick.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint } },
    select: { id: true },
  });
  if (existing) redirect(appendResult(returnTo, "already"));

  const note = optionalText(formData, "note", 2000);
  const decisionAt = new Date();
  const decisionTiming = classifyDecisionTiming({ decisionAt, kickoffAt: match.kickoffAt });
  const data = {
    userId: user.id,
    matchId,
    fingerprint,
    source,
    statKey,
    statLabel: definition.label,
    scope: LineScope.MATCH_TOTAL,
    threshold,
    side,
    projection: optionalNumber(formData, "projection", 0, 500),
    edge: optionalNumber(formData, "edge", 0, 500),
    evidenceStatus: optionalText(formData, "evidenceStatus", 40),
    backtestSignals: optionalInteger(formData, "backtestSignals", 0, 1000000),
    backtestHitRate: optionalNumber(formData, "backtestHitRate", 0, 100),
    edgeBacktestSignals: optionalInteger(formData, "edgeBacktestSignals", 0, 1000000),
    edgeBacktestHitRate: optionalNumber(formData, "edgeBacktestHitRate", 0, 100),
    homeSample: optionalInteger(formData, "homeSample", 0, 1000000),
    awaySample: optionalInteger(formData, "awaySample", 0, 1000000),
    note,
    decisionAt,
    decisionTiming,
  };

  await prisma.$transaction(async (tx) => {
    const item = await tx.analysisPick.create({ data });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_PICK,
        entityId: item.id,
        action: "CREATE_ANALYSIS_PICK",
        userId: user.id,
        changes: {
          create: [
            { fieldName: "matchId", oldValue: null, newValue: matchId },
            { fieldName: "statKey", oldValue: null, newValue: statKey },
            { fieldName: "threshold", oldValue: null, newValue: String(threshold) },
            { fieldName: "side", oldValue: null, newValue: side },
            { fieldName: "source", oldValue: null, newValue: source },
            { fieldName: "decisionAt", oldValue: null, newValue: decisionAt.toISOString() },
            { fieldName: "decisionTiming", oldValue: null, newValue: decisionTiming },
          ],
        },
      },
    });
    await captureForwardSignalsForPick(tx, { pickId: item.id, userId: user.id });
  });

  revalidatePath("/journal");
  revalidatePath("/scanner");
  revalidatePath("/portfolio");
  redirect(appendResult(returnTo, "saved"));
}

export async function updateAnalysisPickAction(formData: FormData) {
  const user = await requireWriteUser();
  const id = text(formData, "id");
  const returnTo = safeReturnPath(formData);
  const status = analysisPickStatus(text(formData, "status"));
  const bookmaker = optionalText(formData, "bookmaker", 120);
  const note = optionalText(formData, "note", 2000);
  const odds = optionalNumber(formData, "odds", 1.01, 1000);
  const closingOdds = optionalNumber(formData, "closingOdds", 1.01, 1000);
  const stake = optionalNumber(formData, "stake", 0.01, 10000000);

  let found = true;
  await prisma.$transaction(async (tx) => {
    await lockTransactionResource(tx, "analysis-pick", id);
    const existing = await tx.analysisPick.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      found = false;
      return;
    }
    if (status === AnalysisPickStatus.SETTLED && existing.result === null) {
      throw new Error("Najpierw rozlicz pozycję automatycznie lub ręcznie.");
    }

    let result = existing.result;
    let actualValue = existing.actualValue;
    let settledAt = existing.settledAt;
    let placedAt = existing.placedAt;

    if (status === AnalysisPickStatus.PLAYED) {
      placedAt = placedAt ?? new Date();
      result = null;
      actualValue = null;
      settledAt = null;
    } else if (status === AnalysisPickStatus.WATCHING || status === AnalysisPickStatus.REJECTED) {
      result = null;
      actualValue = null;
      settledAt = null;
    } else if (status === AnalysisPickStatus.VOID) {
      result = AnalysisPickResult.VOID;
      settledAt = new Date();
    }

    const next = {
      status,
      bookmaker,
      note,
      odds,
      closingOdds,
      stake,
      result,
      actualValue,
      placedAt,
      settledAt,
    };
    const changes = auditChanges(existing, next);
    if (!changes.length) return;

    await tx.analysisPick.update({ where: { id }, data: next });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_PICK,
        entityId: id,
        action: "UPDATE_ANALYSIS_PICK",
        userId: user.id,
        changes: { create: changes },
      },
    });
    await syncForwardSignalsForPick(tx, { pickId: id, userId: user.id });
  });

  if (!found) redirect(appendResult(returnTo, "error", "pick"));
  revalidatePath("/journal");
  revalidatePath("/portfolio");
  redirect(appendResult(returnTo, "updated"));
}


export async function settleAnalysisPickManuallyAction(formData: FormData) {
  const user = await requireWriteUser();
  const id = text(formData, "id");
  const returnTo = safeReturnPath(formData);
  const result = analysisPickResult(text(formData, "result"));
  const actualValue = result === AnalysisPickResult.VOID
    ? optionalNumber(formData, "actualValue", 0, 500)
    : requiredNumber(formData, "actualValue", 0, 500);

  let found = true;
  await prisma.$transaction(async (tx) => {
    await lockTransactionResource(tx, "analysis-pick", id);
    const existing = await tx.analysisPick.findFirst({ where: { id, userId: user.id } });
    if (!existing) {
      found = false;
      return;
    }

    const next = {
      status: result === AnalysisPickResult.VOID
        ? AnalysisPickStatus.VOID
        : AnalysisPickStatus.SETTLED,
      result,
      actualValue,
      settledAt: new Date(),
      placedAt: existing.placedAt ?? new Date(),
    };
    const changes = auditChanges(existing, next);
    if (!changes.length) return;

    await tx.analysisPick.update({ where: { id }, data: next });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_PICK,
        entityId: id,
        action: "MANUAL_SETTLE_ANALYSIS_PICK",
        userId: user.id,
        changes: { create: changes },
      },
    });
    await syncForwardSignalsForPick(tx, { pickId: id, userId: user.id });
  });

  if (!found) redirect(appendResult(returnTo, "error", "pick"));
  revalidatePath("/journal");
  revalidatePath("/portfolio");
  redirect(appendResult(returnTo, "settled", "1"));
}


export async function settleFinishedAnalysisPicksAction(formData: FormData) {
  const user = await requireWriteUser();
  const returnTo = safeReturnPath(formData);
  const candidates = await prisma.analysisPick.findMany({
    where: {
      userId: user.id,
      status: AnalysisPickStatus.PLAYED,
      match: { status: MatchStatus.FINISHED },
    },
    select: { id: true },
  });

  let settled = 0;
  for (const candidate of candidates) {
    const didSettle = await prisma.$transaction(async (tx) => {
      await lockTransactionResource(tx, "analysis-pick", candidate.id);
      const item = await tx.analysisPick.findFirst({
        where: {
          id: candidate.id,
          userId: user.id,
          status: AnalysisPickStatus.PLAYED,
          match: { status: MatchStatus.FINISHED },
        },
        include: { match: { include: { stats: true } } },
      });
      if (!item) return false;

      const definition = trendDefinition(item.statKey as TrendStatKey);
      const stats = item.match.stats;
      if (!definition || !stats) return false;
      const home = stats[definition.home];
      const away = stats[definition.away];

      let actualValue: number | null = null;
      if (item.scope === LineScope.MATCH_TOTAL) {
        if (typeof home === "number" && typeof away === "number") actualValue = home + away;
      } else if (item.selectedTeamId) {
        const selectedValue = item.match.homeTeamId === item.selectedTeamId ? home
          : item.match.awayTeamId === item.selectedTeamId ? away
            : null;
        const opponentValue = item.match.homeTeamId === item.selectedTeamId ? away
          : item.match.awayTeamId === item.selectedTeamId ? home
            : null;
        const value = item.scope === LineScope.TEAM_FOR ? selectedValue : opponentValue;
        if (typeof value === "number") actualValue = value;
      }
      if (actualValue === null) return false;

      const result = settleTotalSelection({
        actual: actualValue,
        threshold: item.threshold,
        side: item.side,
      });
      const settledAt = new Date();
      const claimed = await tx.analysisPick.updateMany({
        where: { id: item.id, userId: user.id, status: AnalysisPickStatus.PLAYED },
        data: {
          status: AnalysisPickStatus.SETTLED,
          result,
          actualValue,
          settledAt,
        },
      });
      if (claimed.count !== 1) return false;

      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.ANALYSIS_PICK,
          entityId: item.id,
          action: "AUTO_SETTLE_ANALYSIS_PICK",
          userId: user.id,
          changes: {
            create: [
              {
                fieldName: "status",
                oldValue: item.status,
                newValue: AnalysisPickStatus.SETTLED,
              },
              {
                fieldName: "result",
                oldValue: valueToString(item.result),
                newValue: result,
              },
              {
                fieldName: "actualValue",
                oldValue: valueToString(item.actualValue),
                newValue: String(actualValue),
              },
              {
                fieldName: "settledAt",
                oldValue: valueToString(item.settledAt),
                newValue: settledAt.toISOString(),
              },
            ],
          },
        },
      });
      await syncForwardSignalsForPick(tx, { pickId: item.id, userId: user.id });
      return true;
    });
    if (didSettle) settled += 1;
  }

  revalidatePath("/journal");
  revalidatePath("/portfolio");
  redirect(appendResult(returnTo, "settled", String(settled)));
}
