import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  JOURNAL_ANALYTICS_LIMIT,
  JOURNAL_PAGE_SIZE,
  normalizeJournalPagination,
} from "@/lib/journal/journal-pagination";
import { measureServerOperation } from "@/lib/performance/measure-server-operation";
import {
  summarizeJournal,
  summarizeJournalAnalytics,
  type JournalAnalyticsEntry,
  type JournalMetricEntry,
} from "@/lib/stats/analysis-journal";
import {
  summarizeJournalCalibration,
  type CalibrationEntry,
} from "@/lib/stats/journal-calibration";

export type AnalysisJournalFilters = {
  userId: string;
  seasonId?: string | null;
  leagueId?: string | null;
  status?: string | null;
  statKey?: string | null;
  source?: string | null;
  from?: Date | null;
  to?: Date | null;
};

type JournalSummarySource = {
  status: JournalMetricEntry["status"];
  result: JournalMetricEntry["result"];
  odds: number | null;
  closingOdds: number | null;
  stake: number | null;
  modelProbability: number | null;
  expectedValue: number | null;
  modelVersion: string | null;
  statKey: string;
  statLabel: string;
  side: JournalAnalyticsEntry["side"];
  source: JournalAnalyticsEntry["source"];
  evidenceStatus: string | null;
  match: {
    season: {
      league: {
        id: string;
        name: string;
      };
    };
  };
};

function analysisJournalWhere(
  input: AnalysisJournalFilters,
): Prisma.AnalysisPickWhereInput {
  const matchWhere = {
    ...(input.seasonId ? { seasonId: input.seasonId } : {}),
    ...(input.leagueId
      ? { season: { leagueId: input.leagueId } }
      : {}),
    ...(input.from || input.to
      ? {
          kickoffAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lt: input.to } : {}),
          },
        }
      : {}),
  };

  return {
    userId: input.userId,
    ...(Object.keys(matchWhere).length ? { match: matchWhere } : {}),
    ...(input.status ? { status: input.status as never } : {}),
    ...(input.statKey ? { statKey: input.statKey } : {}),
    ...(input.source ? { source: input.source as never } : {}),
  };
}

const journalItemInclude = {
  match: {
    include: {
      homeTeam: true,
      awayTeam: true,
      season: { include: { league: true } },
    },
  },
} as const;

const journalOrderBy = [
  { status: "asc" as const },
  { match: { kickoffAt: "desc" as const } },
  { createdAt: "desc" as const },
];

function summarizeItems(items: readonly JournalSummarySource[]) {
  const metricEntries: JournalMetricEntry[] = items.map((item) => ({
    status: item.status,
    result: item.result,
    odds: item.odds,
    closingOdds: item.closingOdds,
    stake: item.stake,
  }));

  const analyticsEntries: JournalAnalyticsEntry[] = items.map((item) => ({
    status: item.status,
    result: item.result,
    odds: item.odds,
    closingOdds: item.closingOdds,
    stake: item.stake,
    leagueId: item.match.season.league.id,
    leagueName: item.match.season.league.name,
    statKey: item.statKey,
    statLabel: item.statLabel,
    side: item.side,
    source: item.source,
    evidenceStatus: item.evidenceStatus,
  }));

  const calibrationEntries: CalibrationEntry[] = items.map((item) => ({
    status: item.status,
    result: item.result,
    odds: item.odds,
    stake: item.stake,
    modelProbability: item.modelProbability,
    expectedValue: item.expectedValue,
    modelVersion: item.modelVersion,
    leagueId: item.match.season.league.id,
    leagueName: item.match.season.league.name,
    statKey: item.statKey,
    statLabel: item.statLabel,
    side: item.side,
  }));

  return {
    metrics: summarizeJournal(metricEntries),
    analytics: summarizeJournalAnalytics(analyticsEntries),
    calibration: summarizeJournalCalibration(calibrationEntries),
  };
}

export async function loadAnalysisJournal(
  input: AnalysisJournalFilters,
) {
  return measureServerOperation("load-analysis-journal-full", async () => {
    const items = await prisma.analysisPick.findMany({
      where: analysisJournalWhere(input),
      include: journalItemInclude,
      orderBy: journalOrderBy,
    });

    return {
      items,
      ...summarizeItems(items),
    };
  });
}

export async function loadAnalysisJournalPage(
  input: AnalysisJournalFilters & {
    page?: number | null;
    pageSize?: number | null;
  },
) {
  return measureServerOperation("load-analysis-journal-page", async () => {
    const where = analysisJournalWhere(input);
    const totalItems = await prisma.analysisPick.count({ where });
    const pagination = normalizeJournalPagination({
      requestedPage: input.page,
      requestedPageSize: input.pageSize ?? JOURNAL_PAGE_SIZE,
      totalItems,
    });

    const [items, analyticsRowsWithOverflow] = await Promise.all([
      prisma.analysisPick.findMany({
        where,
        include: journalItemInclude,
        orderBy: journalOrderBy,
        skip: pagination.skip,
        take: pagination.pageSize,
      }),
      prisma.analysisPick.findMany({
        where,
        select: {
          status: true,
          result: true,
          odds: true,
          closingOdds: true,
          stake: true,
          modelProbability: true,
          expectedValue: true,
          modelVersion: true,
          statKey: true,
          statLabel: true,
          side: true,
          source: true,
          evidenceStatus: true,
          match: {
            select: {
              season: {
                select: {
                  league: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: [
          { match: { kickoffAt: "desc" } },
          { createdAt: "desc" },
        ],
        take: JOURNAL_ANALYTICS_LIMIT + 1,
      }),
    ]);

    const analyticsTruncated =
      analyticsRowsWithOverflow.length > JOURNAL_ANALYTICS_LIMIT;
    const analyticsRows = analyticsRowsWithOverflow.slice(
      0,
      JOURNAL_ANALYTICS_LIMIT,
    );

    return {
      items,
      ...summarizeItems(analyticsRows),
      pagination,
      analyticsTruncated,
      analyticsLimit: JOURNAL_ANALYTICS_LIMIT,
    };
  });
}
