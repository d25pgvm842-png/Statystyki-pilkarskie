import { cache } from "react";
import { prisma } from "@/lib/db";
import { measureServerOperation } from "@/lib/performance/measure-server-operation";

const ALL_MATCHES_KEY = "ALL";

const loadCachedSeasonAnalysisDataset = cache(
  async (seasonId: string, beforeKey: string) =>
    measureServerOperation(
      "load-season-analysis-dataset",
      async () => {
        const [season, matches] = await Promise.all([
          prisma.season.findUnique({
            where: { id: seasonId },
            include: {
              league: true,
              teams: {
                include: { team: true },
                orderBy: { team: { name: "asc" } },
              },
            },
          }),
          prisma.match.findMany({
            where: {
              seasonId,
              status: "FINISHED",
              ...(beforeKey === ALL_MATCHES_KEY
                ? {}
                : { kickoffAt: { lt: new Date(beforeKey) } }),
            },
            select: {
              id: true,
              kickoffAt: true,
              homeTeamId: true,
              awayTeamId: true,
              homeScore: true,
              awayScore: true,
              stats: true,
              homeTeam: {
                select: { id: true, name: true },
              },
              awayTeam: {
                select: { id: true, name: true },
              },
            },
            orderBy: { kickoffAt: "asc" },
          }),
        ]);

        if (!season) return null;

        return {
          season,
          teams: season.teams.map((membership) => ({
            id: membership.team.id,
            name: membership.team.name,
            shortName: membership.team.shortName,
          })),
          matches,
        };
      },
    ),
);

export function loadSeasonAnalysisDataset(input: {
  seasonId: string;
  before?: Date | string | null;
}) {
  const beforeKey = input.before
    ? new Date(input.before).toISOString()
    : ALL_MATCHES_KEY;

  return loadCachedSeasonAnalysisDataset(input.seasonId, beforeKey);
}

export type SeasonAnalysisDataset = NonNullable<
  Awaited<ReturnType<typeof loadSeasonAnalysisDataset>>
>;
