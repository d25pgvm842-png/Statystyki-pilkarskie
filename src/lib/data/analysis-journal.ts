import { prisma } from "@/lib/db";
import {
  summarizeJournal,
  summarizeJournalAnalytics,
  type JournalAnalyticsEntry,
  type JournalMetricEntry,
} from "@/lib/stats/analysis-journal";

export async function loadAnalysisJournal(input: {
  userId: string;
  seasonId?: string | null;
  leagueId?: string | null;
  status?: string | null;
  statKey?: string | null;
  source?: string | null;
  from?: Date | null;
  to?: Date | null;
}) {
  const matchWhere = {
    ...(input.seasonId ? { seasonId: input.seasonId } : {}),
    ...(input.leagueId ? { season: { leagueId: input.leagueId } } : {}),
    ...(input.from || input.to
      ? {
          kickoffAt: {
            ...(input.from ? { gte: input.from } : {}),
            ...(input.to ? { lt: input.to } : {}),
          },
        }
      : {}),
  };

  const items = await prisma.analysisPick.findMany({
    where: {
      userId: input.userId,
      ...(Object.keys(matchWhere).length ? { match: matchWhere } : {}),
      ...(input.status ? { status: input.status as never } : {}),
      ...(input.statKey ? { statKey: input.statKey } : {}),
      ...(input.source ? { source: input.source as never } : {}),
    },
    include: {
      match: {
        include: {
          homeTeam: true,
          awayTeam: true,
          season: { include: { league: true } },
        },
      },
    },
    orderBy: [
      { status: "asc" },
      { match: { kickoffAt: "desc" } },
      { createdAt: "desc" },
    ],
  });

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

  return {
    items,
    metrics: summarizeJournal(metricEntries),
    analytics: summarizeJournalAnalytics(analyticsEntries),
  };
}
