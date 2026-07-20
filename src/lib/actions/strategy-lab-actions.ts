"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuditEntityType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TREND_STAT_DEFINITIONS } from "@/lib/stats/trends";
import { valueToString } from "@/lib/utils";

const decisionModes = new Set(["ALL", "PLAYED", "SETTLED", "WATCHING"]);
const sides = new Set(["OVER", "UNDER"]);
const scopes = new Set(["MATCH_TOTAL", "TEAM_FOR", "TEAM_AGAINST"]);
const targets = new Set(["MATCH_TOTAL", "HOME_TEAM", "AWAY_TEAM"]);
const sources = new Set(["SCANNER", "MANUAL"]);
const confidence = new Set(["NO_DATA", "WEAK", "LIMITED", "MEDIUM", "STRONG"]);
const marketStatuses = new Set([
  "INSUFFICIENT_DATA",
  "NO_ODDS",
  "NO_EDGE",
  "WATCH",
  "POTENTIAL_VALUE",
]);
const evidenceStatuses = new Set(["SUPPORTED", "WATCH", "WEAK", "UNVERIFIED"]);
const statKeys = new Set<string>(TREND_STAT_DEFINITIONS.map((item) => item.key));

function text(formData: FormData, name: string, maxLength: number) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;
  if (value.length > maxLength) throw new Error(`Pole ${name} jest za długie.`);
  return value;
}

function selected(formData: FormData, name: string, values: Set<string>) {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) return null;
  if (!values.has(value)) throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  return value;
}

function optionalNumber(
  formData: FormData,
  name: string,
  input: { min: number; max: number; integer?: boolean },
) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (
    !Number.isFinite(value)
    || value < input.min
    || value > input.max
    || (input.integer && !Number.isInteger(value))
  ) {
    throw new Error(`Nieprawidłowa wartość pola ${name}.`);
  }
  return value;
}

function safeReturnTo(formData: FormData) {
  const value = String(formData.get("returnTo") ?? "").trim();
  return value.startsWith("/strategies") ? value : "/strategies";
}

function appendResult(path: string, key: string, value = "1") {
  const url = new URL(path, "http://local");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

function strategyInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 3 || name.length > 80) {
    throw new Error("Nazwa strategii musi mieć od 3 do 80 znaków.");
  }
  const statKey = text(formData, "statKey", 80);
  if (statKey && !statKeys.has(statKey)) throw new Error("Nieznany rynek strategii.");

  const decisionMode = selected(formData, "decisionMode", decisionModes) ?? "ALL";
  const scope = selected(formData, "scope", scopes);
  const target = selected(formData, "target", targets);
  if (scope === "MATCH_TOTAL" && target && target !== "MATCH_TOTAL") {
    throw new Error("Suma meczu nie może wskazywać wyłącznie gospodarza lub gościa.");
  }
  if (scope && scope !== "MATCH_TOTAL" && target === "MATCH_TOTAL") {
    throw new Error("Rynek drużynowy nie może wskazywać sumy całego meczu.");
  }
  const minModelProbability = optionalNumber(formData, "minModelProbability", { min: 0, max: 100 });
  const maxModelProbability = optionalNumber(formData, "maxModelProbability", { min: 0, max: 100 });
  const minExpectedValue = optionalNumber(formData, "minExpectedValue", { min: -100, max: 1000 });
  const maxExpectedValue = optionalNumber(formData, "maxExpectedValue", { min: -100, max: 1000 });
  const minOdds = optionalNumber(formData, "minOdds", { min: 1.01, max: 1000 });
  const maxOdds = optionalNumber(formData, "maxOdds", { min: 1.01, max: 1000 });
  const minThreshold = optionalNumber(formData, "minThreshold", { min: 0, max: 500 });
  const maxThreshold = optionalNumber(formData, "maxThreshold", { min: 0, max: 500 });

  if (
    minModelProbability !== null
    && maxModelProbability !== null
    && minModelProbability > maxModelProbability
  ) throw new Error("Minimalne prawdopodobieństwo nie może przekraczać maksymalnego.");
  if (
    minExpectedValue !== null
    && maxExpectedValue !== null
    && minExpectedValue > maxExpectedValue
  ) throw new Error("Minimalne EV nie może przekraczać maksymalnego.");
  if (minOdds !== null && maxOdds !== null && minOdds > maxOdds) {
    throw new Error("Minimalny kurs nie może przekraczać maksymalnego.");
  }
  if (minThreshold !== null && maxThreshold !== null && minThreshold > maxThreshold) {
    throw new Error("Minimalna linia nie może przekraczać maksymalnej.");
  }

  return {
    name,
    description: text(formData, "description", 1000),
    leagueId: text(formData, "leagueId", 80),
    seasonId: text(formData, "seasonId", 80),
    statKey,
    scope,
    target,
    side: selected(formData, "side", sides),
    source: selected(formData, "source", sources),
    modelVersion: text(formData, "modelVersion", 120),
    marketStatus: selected(formData, "marketStatus", marketStatuses),
    evidenceStatus: selected(formData, "evidenceStatus", evidenceStatuses),
    bookmaker: text(formData, "bookmaker", 120),
    decisionMode,
    minModelProbability,
    maxModelProbability,
    minExpectedValue,
    maxExpectedValue,
    minOdds,
    maxOdds,
    minThreshold,
    maxThreshold,
    minEdge: optionalNumber(formData, "minEdge", { min: 0, max: 500 }),
    minModelSample: optionalNumber(formData, "minModelSample", { min: 1, max: 10000, integer: true }),
    minCoverage: optionalNumber(formData, "minCoverage", { min: 0, max: 100 }),
    minBacktestSignals: optionalNumber(formData, "minBacktestSignals", { min: 1, max: 100000, integer: true }),
    minBacktestHitRate: optionalNumber(formData, "minBacktestHitRate", { min: 0, max: 100 }),
    minimumConfidence: selected(formData, "minimumConfidence", confidence),
  };
}

type StrategyInput = ReturnType<typeof strategyInput>;

async function validateReferences(data: StrategyInput) {
  const [league, season] = await Promise.all([
    data.leagueId
      ? prisma.league.findUnique({ where: { id: data.leagueId }, select: { id: true } })
      : null,
    data.seasonId
      ? prisma.season.findUnique({
          where: { id: data.seasonId },
          select: { id: true, leagueId: true },
        })
      : null,
  ]);
  if (data.leagueId && !league) throw new Error("Wybrana liga nie istnieje.");
  if (data.seasonId && !season) throw new Error("Wybrany sezon nie istnieje.");
  if (data.leagueId && season && season.leagueId !== data.leagueId) {
    throw new Error("Wybrany sezon nie należy do wskazanej ligi.");
  }
}

async function validatedStrategyInput(formData: FormData, returnTo: string): Promise<StrategyInput> {
  try {
    const data = strategyInput(formData);
    await validateReferences(data);
    return data;
  } catch {
    redirect(appendResult(returnTo, "error", "validation"));
  }
}

function copyData(current: {
  description: string | null;
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
    description: current.description,
    leagueId: current.leagueId,
    seasonId: current.seasonId,
    statKey: current.statKey,
    scope: current.scope,
    target: current.target,
    side: current.side,
    source: current.source,
    modelVersion: current.modelVersion,
    marketStatus: current.marketStatus,
    evidenceStatus: current.evidenceStatus,
    bookmaker: current.bookmaker,
    decisionMode: current.decisionMode,
    minModelProbability: current.minModelProbability,
    maxModelProbability: current.maxModelProbability,
    minExpectedValue: current.minExpectedValue,
    maxExpectedValue: current.maxExpectedValue,
    minOdds: current.minOdds,
    maxOdds: current.maxOdds,
    minThreshold: current.minThreshold,
    maxThreshold: current.maxThreshold,
    minEdge: current.minEdge,
    minModelSample: current.minModelSample,
    minCoverage: current.minCoverage,
    minBacktestSignals: current.minBacktestSignals,
    minBacktestHitRate: current.minBacktestHitRate,
    minimumConfidence: current.minimumConfidence,
  };
}

export async function createAnalysisStrategyAction(formData: FormData) {
  const user = await requireUser();
  const returnTo = safeReturnTo(formData);
  const data = await validatedStrategyInput(formData, returnTo);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const strategy = await tx.analysisStrategy.create({
        data: { userId: user.id, active: false, status: "DRAFT", ...data },
      });
      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.ANALYSIS_STRATEGY,
          entityId: strategy.id,
          action: "CREATE_ANALYSIS_STRATEGY",
          userId: user.id,
          changes: {
            create: Object.entries(data).map(([fieldName, newValue]) => ({
              fieldName,
              oldValue: null,
              newValue: valueToString(newValue),
            })),
          },
        },
      });
      return strategy;
    });
    revalidatePath("/strategies");
    revalidatePath("/portfolio");
    redirect(`/strategies?strategyId=${created.id}&created=1`);
  } catch (error) {
    if (databaseErrorCode(error) === "P2002") {
      redirect(appendResult(returnTo, "error", "name"));
    }
    throw error;
  }
}

export async function updateAnalysisStrategyAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  const returnTo = safeReturnTo(formData);
  if (!id) redirect(appendResult(returnTo, "error", "missing"));

  const data = await validatedStrategyInput(formData, returnTo);

  const current = await prisma.analysisStrategy.findFirst({ where: { id, userId: user.id } });
  if (!current) redirect(appendResult(returnTo, "error", "missing"));
  if (current.status === "FORWARD_TEST" || current.status === "APPROVED") {
    redirect(appendResult(returnTo, "error", "locked"));
  }

  const changed = Object.entries(data).filter(
    ([fieldName, newValue]) =>
      valueToString(current[fieldName as keyof typeof current]) !== valueToString(newValue),
  );

  try {
    await prisma.$transaction(async (tx) => {
      await tx.analysisStrategy.update({
        where: { id },
        data: changed.length ? { ...data, active: false, status: "DRAFT" } : data,
      });
      if (changed.length) {
        await tx.auditLog.create({
          data: {
            entityType: AuditEntityType.ANALYSIS_STRATEGY,
            entityId: id,
            action: "UPDATE_ANALYSIS_STRATEGY",
            userId: user.id,
            changes: {
              create: [
                ...changed.map(([fieldName, newValue]) => ({
                  fieldName,
                  oldValue: valueToString(current[fieldName as keyof typeof current]),
                  newValue: valueToString(newValue),
                })),
                ...(current.active
                  ? [{ fieldName: "active", oldValue: "true", newValue: "false" }]
                  : []),
                ...(current.status !== "DRAFT"
                  ? [{ fieldName: "status", oldValue: current.status, newValue: "DRAFT" }]
                  : []),
              ],
            },
          },
        });
      }
    });
    revalidatePath("/strategies");
    revalidatePath("/portfolio");
    redirect(`/strategies?strategyId=${id}&updated=1`);
  } catch (error) {
    if (databaseErrorCode(error) === "P2002") {
      redirect(appendResult(returnTo, "error", "name"));
    }
    throw error;
  }
}

export async function toggleAnalysisStrategyAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/strategies?error=missing");
  const current = await prisma.analysisStrategy.findFirst({ where: { id, userId: user.id } });
  if (!current) redirect("/strategies?error=missing");
  if (current.status === "FORWARD_TEST" || current.status === "APPROVED") {
    redirect(`/strategies?strategyId=${id}&error=locked`);
  }
  const active = !current.active;

  await prisma.$transaction(async (tx) => {
    await tx.analysisStrategy.update({ where: { id }, data: { active } });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: id,
        action: active ? "ACTIVATE_ANALYSIS_STRATEGY" : "PAUSE_ANALYSIS_STRATEGY",
        userId: user.id,
        changes: {
          create: [{
            fieldName: "active",
            oldValue: String(current.active),
            newValue: String(active),
          }],
        },
      },
    });
  });
  revalidatePath("/strategies");
  revalidatePath("/portfolio");
  redirect(`/strategies?strategyId=${id}&toggled=1`);
}

export async function duplicateAnalysisStrategyAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/strategies?error=missing");
  const current = await prisma.analysisStrategy.findFirst({ where: { id, userId: user.id } });
  if (!current) redirect("/strategies?error=missing");

  const existingNames = new Set(
    (await prisma.analysisStrategy.findMany({
      where: { userId: user.id },
      select: { name: true },
    })).map((item) => item.name.toLocaleLowerCase("pl")),
  );
  let name = `${current.name} — kopia`;
  for (let index = 2; existingNames.has(name.toLocaleLowerCase("pl")); index += 1) {
    name = `${current.name} — kopia ${index}`;
  }

  const created = await prisma.$transaction(async (tx) => {
    const strategy = await tx.analysisStrategy.create({
      data: {
        userId: user.id,
        name,
        active: false,
        status: "DRAFT",
        ...copyData(current),
      },
    });
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.ANALYSIS_STRATEGY,
        entityId: strategy.id,
        action: "DUPLICATE_ANALYSIS_STRATEGY",
        userId: user.id,
        changes: {
          create: [
            { fieldName: "sourceStrategyId", oldValue: null, newValue: current.id },
            { fieldName: "name", oldValue: null, newValue: name },
          ],
        },
      },
    });
    return strategy;
  });
  revalidatePath("/strategies");
  revalidatePath("/portfolio");
  redirect(`/strategies?strategyId=${created.id}&duplicated=1`);
}
