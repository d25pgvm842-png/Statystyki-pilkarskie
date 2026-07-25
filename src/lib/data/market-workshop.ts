import { prisma } from "@/lib/db";
import { loadSeasonAnalysisDataset } from "@/lib/data/season-analysis-dataset";
import { measureServerOperation } from "@/lib/performance/measure-server-operation";
import {
  buildMarketWorkshop,
  type MarketWorkshopTarget,
} from "@/lib/stats/market-workshop";
import type { RatingLookback } from "@/lib/stats/market-ratings";
import type { TrendStatKey } from "@/lib/stats/trends";

export async function loadMarketWorkshop(input: {
  matchId: string;
  statKey: TrendStatKey;
  target: MarketWorkshopTarget;
  line: number;
  lookback: RatingLookback;
  overOdds?: number | null;
  underOdds?: number | null;
}) {
  return measureServerOperation("load-market-workshop", async () => {
    const match = await prisma.match.findUnique({
      where: { id: input.matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        season: {
          include: {
            league: true,
          },
        },
      },
    });
    if (!match) return null;

    const dataset = await loadSeasonAnalysisDataset({
      seasonId: match.seasonId,
      before: match.kickoffAt,
    });
    if (!dataset) return null;

    return {
      match: {
        ...match,
        season: dataset.season,
      },
      workshop: buildMarketWorkshop({
        teams: dataset.teams,
        matches: [...dataset.matches].reverse(),
        statKey: input.statKey,
        target: input.target,
        line: input.line,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        lookback: input.lookback,
        minSample: 3,
        before: match.kickoffAt,
        overOdds: input.overOdds,
        underOdds: input.underOdds,
      }),
    };
  });
}
