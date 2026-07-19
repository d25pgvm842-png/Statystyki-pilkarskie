import { randomUUID } from "node:crypto";
import {
  CurrentDataSyncRunStatus,
  CurrentDataSyncTrigger,
  ImportStatus,
} from "@/generated/prisma/enums";
import { prepareCurrentPublicBatch } from "@/lib/actions/public-data-actions";
import { prisma } from "@/lib/db";
import {
  FOOTBALL_DATA_ORG_PROVIDER_CODE,
  FOOTBALL_DATA_UK_PROVIDER_CODE,
  OPEN_FOOTBALL_PROVIDER_CODE,
} from "@/lib/public-data/provider";
import {
  parseCurrentSyncDay,
  selectNextCurrentSyncCandidate,
} from "@/lib/current-data/sync-policy";

const LOCK_ID = "current-data-preparation";
const LOCK_TTL_MS = 20 * 60 * 1000;

export class CurrentDataSyncBusyError extends Error {
  constructor() {
    super("Inne przygotowanie bieżących danych jest już w toku. Spróbuj ponownie po jego zakończeniu.");
    this.name = "CurrentDataSyncBusyError";
  }
}

async function acquireCurrentDataLock() {
  const now = new Date();
  const token = randomUUID();
  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS);

  await prisma.currentDataSyncLock.upsert({
    where: { id: LOCK_ID },
    update: {},
    create: { id: LOCK_ID },
  });

  const claimed = await prisma.currentDataSyncLock.updateMany({
    where: {
      id: LOCK_ID,
      OR: [
        { lockedUntil: null },
        { lockedUntil: { lt: now } },
      ],
    },
    data: { lockToken: token, lockedUntil },
  });

  if (claimed.count !== 1) throw new CurrentDataSyncBusyError();

  await prisma.currentDataSyncRun.updateMany({
    where: {
      status: CurrentDataSyncRunStatus.PREPARING,
      updatedAt: { lt: new Date(now.getTime() - LOCK_TTL_MS) },
    },
    data: {
      status: CurrentDataSyncRunStatus.FAILED,
      finishedAt: now,
      error: "Przygotowanie zostało przerwane przed zakończeniem.",
    },
  });

  return token;
}

async function releaseCurrentDataLock(token: string) {
  await prisma.currentDataSyncLock.updateMany({
    where: { id: LOCK_ID, lockToken: token },
    data: { lockToken: null, lockedUntil: null },
  });
}

export type SelectedCurrentSyncSeason = {
  id: string;
  name: string;
  league: { id: string; name: string; code: string; country: string };
  lastSelectedAt: Date | null;
};

export async function selectNextCurrentSyncSeason(): Promise<SelectedCurrentSyncSeason | null> {
  const seasons = await prisma.season.findMany({
    where: { active: true, league: { active: true } },
    include: {
      league: true,
      currentDataSyncRuns: {
        orderBy: { lastSelectedAt: "desc" },
        take: 1,
        select: { lastSelectedAt: true },
      },
    },
    orderBy: { league: { name: "asc" } },
  });

  const selected = selectNextCurrentSyncCandidate(
    seasons.map((season) => ({
      id: season.id,
      name: season.name,
      league: season.league,
      label: `${season.league.name} · ${season.name}`,
      lastSelectedAt: season.currentDataSyncRuns[0]?.lastSelectedAt ?? null,
    })),
  );

  return selected
    ? {
        id: selected.id,
        name: selected.name,
        league: selected.league,
        lastSelectedAt: selected.lastSelectedAt instanceof Date
          ? selected.lastSelectedAt
          : selected.lastSelectedAt
            ? new Date(selected.lastSelectedAt)
            : null,
      }
    : null;
}

function storedSeasonId(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const seasonId = (value as Record<string, unknown>).seasonId;
  return typeof seasonId === "string" ? seasonId : null;
}

async function findLegacyActiveBatch(input: {
  seasonId: string;
  fromValue: string;
  toValue: string;
}) {
  const candidates = await prisma.importBatch.findMany({
    where: {
      status: { in: [ImportStatus.READY, ImportStatus.VALIDATING] },
      fileName: { endsWith: `${input.fromValue}–${input.toValue}` },
      source: {
        providerCode: {
          in: [
            FOOTBALL_DATA_ORG_PROVIDER_CODE,
            FOOTBALL_DATA_UK_PROVIDER_CODE,
            OPEN_FOOTBALL_PROVIDER_CODE,
          ],
        },
      },
    },
    include: {
      source: true,
      rows: {
        orderBy: { rowNumber: "asc" },
        take: 1,
        select: { rawData: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return candidates.find((batch) => storedSeasonId(batch.rows[0]?.rawData) === input.seasonId) ?? null;
}

export async function prepareTrackedCurrentPublicBatch(input: {
  userId: string;
  seasonId: string;
  fromValue: string;
  toValue: string;
  trigger: CurrentDataSyncTrigger;
  batchNamePrefix?: string;
}) {
  const rangeFrom = parseCurrentSyncDay(input.fromValue);
  const rangeTo = parseCurrentSyncDay(input.toValue);
  if (!rangeFrom || !rangeTo || rangeTo < rangeFrom) {
    throw new Error("Zakres danych bieżących musi zawierać prawidłowe daty.");
  }

  const lockToken = await acquireCurrentDataLock();
  let runId: string | null = null;

  try {
    const season = await prisma.season.findUnique({
      where: { id: input.seasonId },
      include: { league: true },
    });
    if (!season) throw new Error("Nie udało się ustalić ligi lub sezonu.");

    const existing = await prisma.currentDataSyncRun.findFirst({
      where: {
        seasonId: input.seasonId,
        rangeFrom,
        rangeTo,
        batch: {
          is: {
            status: { in: [ImportStatus.READY, ImportStatus.VALIDATING] },
          },
        },
      },
      include: {
        batch: { include: { source: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    if (existing?.batch) {
      const selectedAt = new Date();
      await prisma.currentDataSyncRun.update({
        where: { id: existing.id },
        data: { lastSelectedAt: selectedAt },
      });

      return {
        batchId: existing.batch.id,
        providerCode: existing.batch.source?.providerCode ?? null,
        providerName: existing.batch.source?.name ?? "Źródło publiczne",
        matchCount: existing.batch.rowsTotal,
        seasonId: season.id,
        seasonName: season.name,
        leagueName: season.league.name,
        reused: true,
      };
    }

    const legacyBatch = await findLegacyActiveBatch({
      seasonId: input.seasonId,
      fromValue: input.fromValue,
      toValue: input.toValue,
    });
    if (legacyBatch) {
      await prisma.currentDataSyncRun.create({
        data: {
          seasonId: input.seasonId,
          batchId: legacyBatch.id,
          rangeFrom,
          rangeTo,
          trigger: input.trigger,
          status: CurrentDataSyncRunStatus.READY,
          lastSelectedAt: new Date(),
          finishedAt: new Date(),
        },
      });

      return {
        batchId: legacyBatch.id,
        providerCode: legacyBatch.source?.providerCode ?? null,
        providerName: legacyBatch.source?.name ?? "Źródło publiczne",
        matchCount: legacyBatch.rowsTotal,
        seasonId: season.id,
        seasonName: season.name,
        leagueName: season.league.name,
        reused: true,
      };
    }

    const run = await prisma.currentDataSyncRun.create({
      data: {
        seasonId: input.seasonId,
        rangeFrom,
        rangeTo,
        trigger: input.trigger,
        status: CurrentDataSyncRunStatus.PREPARING,
        lastSelectedAt: new Date(),
      },
    });
    runId = run.id;

    const prepared = await prepareCurrentPublicBatch({
      userId: input.userId,
      seasonId: input.seasonId,
      fromValue: input.fromValue,
      toValue: input.toValue,
      batchNamePrefix: input.batchNamePrefix,
    });

    await prisma.currentDataSyncRun.update({
      where: { id: run.id },
      data: {
        batchId: prepared.batchId,
        status: CurrentDataSyncRunStatus.READY,
        finishedAt: new Date(),
        error: null,
      },
    });

    return { ...prepared, reused: false };
  } catch (error) {
    if (runId) {
      await prisma.currentDataSyncRun.update({
        where: { id: runId },
        data: {
          status: CurrentDataSyncRunStatus.FAILED,
          finishedAt: new Date(),
          error: error instanceof Error ? error.message.slice(0, 2000) : "Nieznany błąd przygotowania.",
        },
      }).catch(() => undefined);
    }
    throw error;
  } finally {
    await releaseCurrentDataLock(lockToken).catch(() => undefined);
  }
}
