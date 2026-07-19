import { prisma } from "@/lib/db";
import {
  analyzeCustomLineForMatch,
  buildMarketProjections,
  summarizeForm,
  summarizeReferee,
} from "@/lib/stats/match-analysis";
import {
  TREND_STAT_DEFINITIONS,
  type TrendScope,
  type TrendStatKey,
} from "@/lib/stats/trends";

export type AnalysisLookback = 5 | 10 | 20 | null;

export async function loadMatchAnalysis(input: {
  matchId: string;
  userId: string;
  lookback: AnalysisLookback;
}) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: {
      season: { include: { league: true } },
      homeTeam: true,
      awayTeam: true,
      referee: true,
      dataSource: true,
      analysisNotes: {
        where: { userId: input.userId },
        take: 1,
        select: { content: true, updatedAt: true },
      },
    },
  });
  if (!match) return null;

  const commonWhere = {
    seasonId: match.seasonId,
    status: "FINISHED" as const,
    kickoffAt: { lt: match.kickoffAt },
  };
  const commonSelect = {
    id: true,
    kickoffAt: true,
    homeTeamId: true,
    awayTeamId: true,
    homeScore: true,
    awayScore: true,
    stats: true,
    homeTeam: { select: { id: true, name: true } },
    awayTeam: { select: { id: true, name: true } },
  } as const;

  const lookback = input.lookback;

  const homeRecentQuery = lookback === null
    ? prisma.match.findMany({
        where: {
          ...commonWhere,
          OR: [{ homeTeamId: match.homeTeamId }, { awayTeamId: match.homeTeamId }],
        },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
      })
    : prisma.match.findMany({
        where: {
          ...commonWhere,
          OR: [{ homeTeamId: match.homeTeamId }, { awayTeamId: match.homeTeamId }],
        },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
        take: lookback,
      });

  const awayRecentQuery = lookback === null
    ? prisma.match.findMany({
        where: {
          ...commonWhere,
          OR: [{ homeTeamId: match.awayTeamId }, { awayTeamId: match.awayTeamId }],
        },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
      })
    : prisma.match.findMany({
        where: {
          ...commonWhere,
          OR: [{ homeTeamId: match.awayTeamId }, { awayTeamId: match.awayTeamId }],
        },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
        take: lookback,
      });

  const homeVenueQuery = lookback === null
    ? prisma.match.findMany({
        where: { ...commonWhere, homeTeamId: match.homeTeamId },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
      })
    : prisma.match.findMany({
        where: { ...commonWhere, homeTeamId: match.homeTeamId },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
        take: lookback,
      });

  const awayVenueQuery = lookback === null
    ? prisma.match.findMany({
        where: { ...commonWhere, awayTeamId: match.awayTeamId },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
      })
    : prisma.match.findMany({
        where: { ...commonWhere, awayTeamId: match.awayTeamId },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
        take: lookback,
      });

  const [homeRecent, awayRecent, homeVenue, awayVenue, h2h, refereeMatches, customLines] =
    await Promise.all([
      homeRecentQuery,
      awayRecentQuery,
      homeVenueQuery,
      awayVenueQuery,
      prisma.match.findMany({
        where: {
          status: "FINISHED",
          kickoffAt: { lt: match.kickoffAt },
          OR: [
            { homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId },
            { homeTeamId: match.awayTeamId, awayTeamId: match.homeTeamId },
          ],
        },
        select: commonSelect,
        orderBy: { kickoffAt: "desc" },
        take: 5,
      }),
      match.refereeId
        ? prisma.match.findMany({
            where: {
              status: "FINISHED",
              refereeId: match.refereeId,
              kickoffAt: { lt: match.kickoffAt },
            },
            select: commonSelect,
            orderBy: { kickoffAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
      prisma.customLine.findMany({
        where: { userId: input.userId, active: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const projections = buildMarketProjections({
    homeMatches: homeVenue,
    awayMatches: awayVenue,
    homeTeamId: match.homeTeamId,
    awayTeamId: match.awayTeamId,
  });
  const homeForm = summarizeForm(homeRecent, match.homeTeamId);
  const awayForm = summarizeForm(awayRecent, match.awayTeamId);
  const refereeSummary = summarizeReferee(refereeMatches);
  const customLineRows = customLines.flatMap((line) => {
    const definition = TREND_STAT_DEFINITIONS.find((item) => item.key === line.statKey);
    if (!definition) return [];
    return [{
      ...line,
      statLabel: definition.label,
      analysis: analyzeCustomLineForMatch({
        statKey: line.statKey as TrendStatKey,
        scope: line.scope as TrendScope,
        threshold: line.threshold,
        homeMatches: homeVenue,
        awayMatches: awayVenue,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
      }),
    }];
  });

  const weakMarkets = projections.filter(
    (projection) =>
      projection.projectedTotal === null
      || projection.homeProjectionQuality !== "FULL"
      || projection.awayProjectionQuality !== "FULL"
      || projection.homeSample < 3
      || projection.awaySample < 3,
  );

  return {
    match,
    homeRecent,
    awayRecent,
    homeVenue,
    awayVenue,
    h2h,
    refereeMatches,
    homeForm,
    awayForm,
    projections,
    refereeSummary,
    customLineRows,
    weakMarkets,
  };
}

export type LoadedMatchAnalysis = NonNullable<Awaited<ReturnType<typeof loadMatchAnalysis>>>;
export type LoadedHistoryMatch = LoadedMatchAnalysis["homeRecent"][number];
