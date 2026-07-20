"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AnalysisPickSide,
  AnalysisPickSource,
  AnalysisPickStatus,
  AuditEntityType,
  LineScope,
  MatchStatus,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { loadMarketWorkshop } from "@/lib/data/market-workshop";
import { prisma } from "@/lib/db";
import { buildAnalysisPickFingerprint } from "@/lib/stats/analysis-journal";
import {
  isHalfLine,
  type MarketWorkshopSide,
  type MarketWorkshopTarget,
} from "@/lib/stats/market-workshop";
import type { RatingLookback } from "@/lib/stats/market-ratings";
import { trendDefinition, type TrendStatKey } from "@/lib/stats/trends";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalText(formData: FormData, key: string, maximum: number) {
  const value = text(formData, key);
  if (value.length > maximum) throw new Error(`Pole ${key} przekracza limit ${maximum} znaków.`);
  return value || null;
}

function number(formData: FormData, key: string, minimum: number, maximum: number) {
  const value = Number(text(formData, key));
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Nieprawidłowa wartość pola ${key}.`);
  }
  return value;
}

function optionalOdds(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 1 || value > 1000) {
    throw new Error(`Nieprawidłowy kurs ${key}.`);
  }
  return value;
}

function lookback(value: string): RatingLookback {
  if (value === "5" || value === "10" || value === "20") return Number(value) as 5 | 10 | 20;
  return value === "all" ? null : 10;
}

function target(value: string): MarketWorkshopTarget {
  if (value === "HOME_TEAM" || value === "AWAY_TEAM" || value === "MATCH_TOTAL") return value;
  throw new Error("Nieprawidłowy zakres rynku.");
}

function side(value: string): MarketWorkshopSide {
  if (value === "OVER" || value === "UNDER") return value;
  throw new Error("Nieprawidłowy kierunek rynku.");
}

function safeReturnPath(formData: FormData) {
  const value = text(formData, "returnTo");
  return value.startsWith("/analysis") ? value : "/analysis";
}

function appendResult(path: string, key: string, value = "1") {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`;
}

export async function saveMarketWorkshopPickAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnPath(formData);
  const matchId = text(formData, "matchId");
  const statKey = text(formData, "statKey") as TrendStatKey;
  const definition = trendDefinition(statKey);
  if (!matchId || !definition) throw new Error("Brakuje meczu lub rynku.");

  const selectedTarget = target(text(formData, "target"));
  const selectedSide = side(text(formData, "side"));
  const line = number(formData, "line", 0, 500);
  if (!isHalfLine(line)) redirect(appendResult(returnTo, "workshopError", "line"));
  const overOdds = optionalOdds(formData, "overOdds");
  const underOdds = optionalOdds(formData, "underOdds");
  const bookmaker = optionalText(formData, "bookmaker", 120);
  const note = optionalText(formData, "note", 2000);
  const quoteText = text(formData, "quoteCapturedAt");
  const quoteCapturedAt = quoteText && !Number.isNaN(new Date(quoteText).getTime())
    ? new Date(quoteText)
    : new Date();

  const loaded = await loadMarketWorkshop({
    matchId,
    statKey,
    target: selectedTarget,
    line,
    lookback: lookback(text(formData, "lookback")),
    overOdds,
    underOdds,
  });
  if (!loaded) redirect(appendResult(returnTo, "workshopError", "match"));
  if (
    loaded.match.status !== MatchStatus.SCHEDULED
    && loaded.match.status !== MatchStatus.LIVE
  ) {
    redirect(appendResult(returnTo, "workshopError", "status"));
  }

  const result = loaded.workshop.sides[selectedSide];
  if (result.bookmakerOdds === null) {
    redirect(appendResult(returnTo, "workshopError", "odds"));
  }

  const scope = selectedTarget === "MATCH_TOTAL" ? LineScope.MATCH_TOTAL : LineScope.TEAM_FOR;
  const selectedTeamId = loaded.workshop.selectedTeamId;
  const fingerprint = buildAnalysisPickFingerprint({
    matchId,
    statKey,
    scope,
    selectedTeamId,
    threshold: line,
    side: selectedSide,
  });
  const existing = await prisma.analysisPick.findUnique({
    where: { userId_fingerprint: { userId: user.id, fingerprint } },
    select: { id: true },
  });
  if (existing) redirect(appendResult(returnTo, "workshopAlready"));

  const data = {
    userId: user.id,
    matchId,
    fingerprint,
    source: AnalysisPickSource.MANUAL,
    statKey,
    statLabel: definition.label,
    scope,
    selectedTeamId,
    threshold: line,
    side: selectedSide === "OVER" ? AnalysisPickSide.OVER : AnalysisPickSide.UNDER,
    status: AnalysisPickStatus.WATCHING,
    projection: loaded.workshop.projection,
    rawProjection: loaded.workshop.rawProjection,
    adjustedProjection: loaded.workshop.adjustedProjection,
    edge: result.modelVsMarket,
    evidenceStatus: result.status,
    homeSample: loaded.workshop.homeSample,
    awaySample: loaded.workshop.awaySample,
    bookmaker,
    odds: result.bookmakerOdds,
    oppositeOdds: selectedSide === "OVER" ? underOdds : overOdds,
    quoteCapturedAt,
    modelProbability: result.modelProbability,
    fairOdds: result.fairOdds,
    bookmakerMargin: loaded.workshop.bookmakerMargin,
    marketProbability: result.marketProbability,
    expectedValue: result.expectedValue,
    modelSample: loaded.workshop.effectiveSample,
    modelCoverage: loaded.workshop.coverage,
    modelConfidence: loaded.workshop.confidence,
    marketStatus: result.status,
    modelVersion: loaded.workshop.modelVersion,
    note,
  };

  await prisma.$transaction(async (tx) => {
    const item = await tx.analysisPick.create({ data });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_PICK,
        entityId: item.id,
        action: "CREATE_MARKET_WORKSHOP_PICK",
        userId: user.id,
        changes: {
          create: [
            { fieldName: "matchId", oldValue: null, newValue: matchId },
            { fieldName: "statKey", oldValue: null, newValue: statKey },
            { fieldName: "scope", oldValue: null, newValue: scope },
            { fieldName: "selectedTeamId", oldValue: null, newValue: selectedTeamId },
            { fieldName: "threshold", oldValue: null, newValue: String(line) },
            { fieldName: "side", oldValue: null, newValue: selectedSide },
            { fieldName: "odds", oldValue: null, newValue: String(result.bookmakerOdds) },
            { fieldName: "modelVersion", oldValue: null, newValue: loaded.workshop.modelVersion },
          ],
        },
      },
    });
  });

  revalidatePath("/analysis");
  revalidatePath("/journal");
  redirect(appendResult(returnTo, "workshopSaved"));
}
