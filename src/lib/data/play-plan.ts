import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  evaluatePlayPlan,
  type PlayPlanItemInput,
  type PlayPlanRecommendationSnapshot,
} from "@/lib/stats/play-plan";

const DEFAULT_SETTINGS = {
  bankroll: 1000,
  maxDailyStakePercent: 10,
  maxMatchStakePercent: 5,
  maxLeagueStakePercent: 7.5,
  maxMarketStakePercent: 7.5,
};

export function warsawDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function playPlanDateFromKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

export function playPlanSnapshotFromJson(
  value: Prisma.JsonValue,
): PlayPlanRecommendationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const requiredStrings = [
    "capturedAt",
    "matchId",
    "kickoffAt",
    "leagueId",
    "leagueName",
    "seasonName",
    "homeTeamName",
    "awayTeamName",
    "statKey",
    "statLabel",
    "scope",
    "target",
    "side",
    "source",
    "recommendationPriority",
  ];
  if (requiredStrings.some((key) => typeof item[key] !== "string")) return null;
  if (typeof item.threshold !== "number" || typeof item.recommendationScore !== "number") return null;
  if (!Array.isArray(item.reasons) || !Array.isArray(item.warnings) || !Array.isArray(item.blockers)) return null;
  return item as unknown as PlayPlanRecommendationSnapshot;
}

type PlayPlanTransactionClient = Pick<Prisma.TransactionClient, "dailyPlayPlan">;

function evaluationItem(item: {
  id: string;
  status: string;
  plannedStake: number | null;
  oddsSnapshot: number | null;
  snapshot: PlayPlanRecommendationSnapshot;
}): PlayPlanItemInput {
  return {
    id: item.id,
    matchId: item.snapshot.matchId,
    leagueId: item.snapshot.leagueId,
    statKey: item.snapshot.statKey,
    scope: item.snapshot.scope,
    target: item.snapshot.target,
    side: item.snapshot.side,
    threshold: item.snapshot.threshold,
    kickoffAt: new Date(item.snapshot.kickoffAt),
    priority: item.snapshot.recommendationPriority,
    score: item.snapshot.recommendationScore,
    expectedValue: item.snapshot.expectedValue,
    plannedStake: item.plannedStake,
    odds: item.oddsSnapshot,
    status: item.status === "PLAYED" ? "PLAYED" : "SELECTED",
  };
}

export async function loadDailyPlayPlanEvaluation(
  client: PlayPlanTransactionClient,
  input: { userId: string; planDate: Date; now?: Date },
) {
  const now = input.now ?? new Date();
  const plan = await client.dailyPlayPlan.findUnique({
    where: { userId_planDate: { userId: input.userId, planDate: input.planDate } },
    include: {
      items: {
        select: {
          id: true,
          status: true,
          plannedStake: true,
          oddsSnapshot: true,
          snapshot: true,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!plan) return null;
  const items = plan.items.flatMap((item) => {
    const snapshot = playPlanSnapshotFromJson(item.snapshot);
    return snapshot ? [{ ...item, snapshot }] : [];
  });
  const evaluation = evaluatePlayPlan({
    settings: {
      bankroll: plan.bankroll,
      maxDailyStakePercent: plan.maxDailyStakePercent,
      maxMatchStakePercent: plan.maxMatchStakePercent,
      maxLeagueStakePercent: plan.maxLeagueStakePercent,
      maxMarketStakePercent: plan.maxMarketStakePercent,
    },
    items: items.map(evaluationItem),
    now,
  });

  return { plan, items, evaluation };
}

export async function loadDailyPlayPlan(input: {
  userId: string;
  dateKey?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const dateKey = input.dateKey && playPlanDateFromKey(input.dateKey)
    ? input.dateKey
    : warsawDateKey(now);
  const planDate = playPlanDateFromKey(dateKey) as Date;

  const [plan, history] = await Promise.all([
    prisma.dailyPlayPlan.findUnique({
      where: { userId_planDate: { userId: input.userId, planDate } },
      include: {
        items: {
          include: {
            analysisPick: {
              include: {
                selectedTeam: { select: { id: true, name: true } },
                match: {
                  include: {
                    homeTeam: { select: { id: true, name: true } },
                    awayTeam: { select: { id: true, name: true } },
                    season: { include: { league: { select: { id: true, name: true } } } },
                  },
                },
              },
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
        events: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 30,
        },
      },
    }),
    prisma.dailyPlayPlan.findMany({
      where: { userId: input.userId },
      select: {
        id: true,
        planDate: true,
        status: true,
        approvedAt: true,
        _count: { select: { items: true } },
      },
      orderBy: [{ planDate: "desc" }, { createdAt: "desc" }],
      take: 14,
    }),
  ]);

  const items = plan?.items.flatMap((item) => {
    const snapshot = playPlanSnapshotFromJson(item.snapshot);
    return snapshot ? [{ ...item, snapshot }] : [];
  }) ?? [];
  const settings = plan ? {
    bankroll: plan.bankroll,
    maxDailyStakePercent: plan.maxDailyStakePercent,
    maxMatchStakePercent: plan.maxMatchStakePercent,
    maxLeagueStakePercent: plan.maxLeagueStakePercent,
    maxMarketStakePercent: plan.maxMarketStakePercent,
  } : DEFAULT_SETTINGS;
  const evaluation = evaluatePlayPlan({
    settings,
    items: items.map(evaluationItem),
    now,
  });

  return {
    dateKey,
    planDate,
    plan,
    items,
    settings,
    evaluation,
    history,
  };
}

export type LoadedDailyPlayPlan = Awaited<ReturnType<typeof loadDailyPlayPlan>>;
export type LoadedDailyPlayPlanItem = LoadedDailyPlayPlan["items"][number];
