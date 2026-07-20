import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  matchesStrategy,
  type StrategyConfig,
  type StrategyEntry,
} from "@/lib/stats/strategy-lab";
import {
  assessForwardExposure,
  calculateForwardStakePlan,
  forwardBankrollAtDecision,
  isForwardDecisionEligible,
  type ForwardStakeMode,
  type ForwardStakeSettings,
} from "@/lib/stats/strategy-forward";

const activeVersionStatuses = ["FORWARD_TEST", "APPROVED"];

function configFromJson(value: Prisma.JsonValue): StrategyConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  if (typeof item.name !== "string" || typeof item.decisionMode !== "string") return null;
  return item as unknown as StrategyConfig;
}

function stakeSettings(version: {
  stakeMode: string;
  fixedStake: number;
  initialBankroll: number;
  bankrollPercent: number;
  kellyFraction: number;
  maxStakePercent: number;
  maxMatchExposurePercent: number;
  maxLeagueExposurePercent: number;
  maxMarketExposurePercent: number;
  maxDailyExposurePercent: number;
}): ForwardStakeSettings {
  const stakeMode = version.stakeMode === "BANKROLL_PERCENT" || version.stakeMode === "KELLY"
    ? version.stakeMode
    : "FIXED";
  return {
    stakeMode: stakeMode as ForwardStakeMode,
    fixedStake: version.fixedStake,
    initialBankroll: version.initialBankroll,
    bankrollPercent: version.bankrollPercent,
    kellyFraction: version.kellyFraction,
    maxStakePercent: version.maxStakePercent,
    maxMatchExposurePercent: version.maxMatchExposurePercent,
    maxLeagueExposurePercent: version.maxLeagueExposurePercent,
    maxMarketExposurePercent: version.maxMarketExposurePercent,
    maxDailyExposurePercent: version.maxDailyExposurePercent,
  };
}

function targetForPick(pick: {
  scope: string;
  selectedTeamId: string | null;
  match: { homeTeamId: string; awayTeamId: string };
}) {
  if (pick.scope === "MATCH_TOTAL") return "MATCH_TOTAL" as const;
  if (pick.selectedTeamId === pick.match.homeTeamId) return "HOME_TEAM" as const;
  if (pick.selectedTeamId === pick.match.awayTeamId) return "AWAY_TEAM" as const;
  return "UNKNOWN" as const;
}

function strategyEntryFromPick(pick: Awaited<ReturnType<typeof loadPick>>) {
  if (!pick) return null;
  const entry: StrategyEntry = {
    id: pick.id,
    matchId: pick.matchId,
    kickoffAt: pick.match.kickoffAt,
    createdAt: pick.createdAt,
    quoteCapturedAt: pick.quoteCapturedAt,
    leagueId: pick.match.season.league.id,
    leagueName: pick.match.season.league.name,
    seasonId: pick.match.season.id,
    seasonName: pick.match.season.name,
    homeTeamName: pick.match.homeTeam.name,
    awayTeamName: pick.match.awayTeam.name,
    statKey: pick.statKey,
    statLabel: pick.statLabel,
    threshold: pick.threshold,
    scope: pick.scope,
    target: targetForPick(pick),
    side: pick.side,
    source: pick.source,
    status: pick.status,
    result: pick.result,
    odds: pick.odds,
    closingOdds: pick.closingOdds,
    stake: pick.stake,
    projection: pick.projection,
    edge: pick.edge,
    evidenceStatus: pick.evidenceStatus,
    backtestSignals: pick.backtestSignals,
    backtestHitRate: pick.backtestHitRate,
    modelProbability: pick.modelProbability,
    expectedValue: pick.expectedValue,
    modelSample: pick.modelSample,
    modelCoverage: pick.modelCoverage,
    modelConfidence: pick.modelConfidence,
    modelVersion: pick.modelVersion,
    marketStatus: pick.marketStatus,
    bookmaker: pick.bookmaker,
  };
  return entry;
}

type TransactionClient = Prisma.TransactionClient;

function loadPick(tx: TransactionClient, pickId: string, userId: string) {
  return tx.analysisPick.findFirst({
    where: { id: pickId, userId },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          season: { include: { league: true } },
        },
      },
    },
  });
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

export async function captureForwardSignalsForPick(
  tx: TransactionClient,
  input: { pickId: string; userId: string },
) {
  const pick = await loadPick(tx, input.pickId, input.userId);
  if (!pick) return 0;

  const decisionAt = pick.placedAt ?? pick.quoteCapturedAt ?? pick.createdAt;
  const capturedAt = new Date();
  if (decisionAt.getTime() >= pick.match.kickoffAt.getTime()) return 0;
  if (capturedAt.getTime() >= pick.match.kickoffAt.getTime()) return 0;

  const versions = await tx.analysisStrategyVersion.findMany({
    where: {
      userId: input.userId,
      status: { in: activeVersionStatuses },
      activatedAt: { lte: decisionAt },
      endedAt: null,
    },
  });
  if (!versions.length) return 0;

  const entry = strategyEntryFromPick(pick);
  if (!entry) return 0;
  let created = 0;

  for (const version of versions) {
    if (!isForwardDecisionEligible({
      activatedAt: version.activatedAt,
      endedAt: version.endedAt,
      decisionAt,
      capturedAt,
      kickoffAt: pick.match.kickoffAt,
    })) continue;
    const config = configFromJson(version.config);
    if (!config || !matchesStrategy(entry, config)) continue;

    const settings = stakeSettings(version);
    const existing = await tx.strategyForwardSignal.findMany({
      where: { strategyVersionId: version.id },
      select: {
        id: true,
        matchId: true,
        leagueId: true,
        statKey: true,
        kickoffAt: true,
        recommendedStake: true,
        settledAt: true,
        oddsAtSignal: true,
        result: true,
        fixedStake: true,
        percentageStake: true,
        kellyStake: true,
      },
    });
    const fixedBankrollAtSignal = forwardBankrollAtDecision({
      initialBankroll: settings.initialBankroll,
      decisionAt,
      entries: existing,
      variant: "FIXED",
    });
    const percentageBankrollAtSignal = forwardBankrollAtDecision({
      initialBankroll: settings.initialBankroll,
      decisionAt,
      entries: existing,
      variant: "PERCENTAGE",
    });
    const kellyBankrollAtSignal = forwardBankrollAtDecision({
      initialBankroll: settings.initialBankroll,
      decisionAt,
      entries: existing,
      variant: "KELLY",
    });
    const bankrollAtSignal = forwardBankrollAtDecision({
      initialBankroll: settings.initialBankroll,
      decisionAt,
      entries: existing,
      variant: "SELECTED",
    });
    const plan = calculateForwardStakePlan({
      settings,
      modelProbability: pick.modelProbability,
      odds: pick.odds,
      percentageBankroll: percentageBankrollAtSignal,
      kellyBankroll: kellyBankrollAtSignal,
    });
    const exposureStatus = assessForwardExposure({
      settings,
      bankroll: bankrollAtSignal,
      existing: existing
        .filter(
          (signal) =>
            signal.settledAt === null
            || signal.settledAt.getTime() > decisionAt.getTime(),
        )
        .map((signal) => ({
          matchId: signal.matchId,
          leagueId: signal.leagueId,
          statKey: signal.statKey,
          kickoffAt: signal.kickoffAt,
          recommendedStake: signal.recommendedStake,
        })),
      proposed: {
        matchId: pick.matchId,
        leagueId: pick.match.season.league.id,
        statKey: pick.statKey,
        kickoffAt: pick.match.kickoffAt,
        recommendedStake: plan.recommendedStake,
      },
    });

    try {
      await tx.strategyForwardSignal.create({
        data: {
          strategyVersionId: version.id,
          analysisPickId: pick.id,
          matchId: pick.matchId,
          userId: input.userId,
          decisionAt,
          kickoffAt: pick.match.kickoffAt,
          leagueId: pick.match.season.league.id,
          leagueName: pick.match.season.league.name,
          seasonName: pick.match.season.name,
          homeTeamName: pick.match.homeTeam.name,
          awayTeamName: pick.match.awayTeam.name,
          statKey: pick.statKey,
          statLabel: pick.statLabel,
          scope: pick.scope,
          target: entry.target,
          side: pick.side,
          threshold: pick.threshold,
          source: pick.source,
          bookmaker: pick.bookmaker,
          oddsAtSignal: pick.odds,
          closingOdds: pick.closingOdds,
          modelProbability: pick.modelProbability,
          expectedValue: pick.expectedValue,
          projection: pick.projection,
          edge: pick.edge,
          modelVersion: pick.modelVersion,
          bankrollAtSignal,
          fixedBankrollAtSignal,
          percentageBankrollAtSignal,
          kellyBankrollAtSignal,
          fixedStake: plan.fixedStake,
          percentageStake: plan.percentageStake,
          kellyStake: plan.kellyStake,
          recommendedStake: plan.recommendedStake,
          stakeMode: settings.stakeMode,
          exposureStatus,
          result: pick.result,
          actualValue: pick.actualValue,
          settledAt: pick.settledAt,
        },
      });
      created += 1;
    } catch (error) {
      if (databaseErrorCode(error) !== "P2002") throw error;
    }
  }

  return created;
}

export async function syncForwardSignalsForPick(
  tx: TransactionClient,
  input: { pickId: string; userId: string },
) {
  const captured = await captureForwardSignalsForPick(tx, input);
  const pick = await tx.analysisPick.findFirst({
    where: { id: input.pickId, userId: input.userId },
    select: {
      closingOdds: true,
      result: true,
      actualValue: true,
      settledAt: true,
    },
  });
  if (!pick) return captured;

  await tx.strategyForwardSignal.updateMany({
    where: { analysisPickId: input.pickId, userId: input.userId },
    data: {
      closingOdds: pick.closingOdds,
      result: pick.result,
      actualValue: pick.actualValue,
      settledAt: pick.settledAt,
    },
  });
  return captured;
}

export async function syncActiveForwardSignals(userId: string) {
  const earliest = await prisma.analysisStrategyVersion.findFirst({
    where: {
      userId,
      status: { in: activeVersionStatuses },
      endedAt: null,
    },
    orderBy: { activatedAt: "asc" },
    select: { activatedAt: true },
  });
  if (!earliest) return 0;

  const picks = await prisma.analysisPick.findMany({
    where: {
      userId,
      OR: [
        { createdAt: { gte: earliest.activatedAt } },
        { placedAt: { gte: earliest.activatedAt } },
        { quoteCapturedAt: { gte: earliest.activatedAt } },
      ],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let captured = 0;
  for (const pick of picks) {
    captured += await prisma.$transaction((tx) => syncForwardSignalsForPick(tx, {
      pickId: pick.id,
      userId,
    }));
  }
  return captured;
}
