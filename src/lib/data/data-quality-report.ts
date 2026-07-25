import type { Prisma } from "@/generated/prisma/client";
import type { QualityMatch } from "@/lib/data/data-quality";
import { prisma } from "@/lib/db";
import {
  DATA_QUALITY_BATCH_SIZE,
  DATA_QUALITY_SCAN_LIMIT,
  dataQualityBatchPlan,
} from "@/lib/data-quality/data-quality-pagination";
import { measureServerOperation } from "@/lib/performance/measure-server-operation";

const qualityMatchInclude = {
  stats: true,
  dataSource: true,
  season: {
    include: {
      league: true,
    },
  },
  homeTeam: true,
  awayTeam: true,
} as const;

export async function loadDataQualityMatches(input: {
  seasonIds?: readonly string[];
  leagueId?: string | null;
  scanLimit?: number | null;
}) {
  return measureServerOperation(
    "load-data-quality-matches",
    async () => {
      const where: Prisma.MatchWhereInput = {
        ...(input.seasonIds?.length
          ? {
              seasonId: {
                in: [...input.seasonIds],
              },
            }
          : {}),
        ...(input.leagueId && !input.seasonIds?.length
          ? {
              season: {
                leagueId: input.leagueId,
              },
            }
          : {}),
      };
      const totalMatches = await prisma.match.count({
        where,
      });
      const scanLimit =
        input.scanLimit ?? DATA_QUALITY_SCAN_LIMIT;
      const plan = dataQualityBatchPlan({
        totalMatches,
        scanLimit,
        batchSize: DATA_QUALITY_BATCH_SIZE,
      });
      const matches: QualityMatch[] = [];

      for (const batch of plan.batches) {
        const rows = await prisma.match.findMany({
          where,
          include: qualityMatchInclude,
          orderBy: [
            { kickoffAt: "desc" },
            { id: "desc" },
          ],
          skip: batch.skip,
          take: batch.take,
        });

        matches.push(...(rows as QualityMatch[]));

        if (rows.length < batch.take) {
          break;
        }
      }

      return {
        matches,
        totalMatches,
        scannedMatches: matches.length,
        truncated: plan.truncated,
        scanLimit,
      };
    },
  );
}
