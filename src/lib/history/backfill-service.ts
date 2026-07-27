import "server-only";

import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  HistoricalBackfillStatus,
  ImportRowStatus,
  ImportStatus,
} from "@/generated/prisma/enums";
import {
  apiFootballGet,
  ApiFootballError,
} from "@/lib/api-football/client";
import {
  API_FOOTBALL_LEAGUE_IDS,
  API_FOOTBALL_PROVIDER_CODE,
  normalizeFixtureStats,
  normalizeFixtureStatus,
  parseRound,
  type ApiFootballFixture,
} from "@/lib/api-football/provider";
import { prisma } from "@/lib/db";
import {
  HISTORICAL_COMMIT_CHUNK_SIZE,
  finishedFixtureIds,
  historicalCoverage,
  historicalSeasonName,
  nextFixtureChunk,
  percentage,
} from "@/lib/history/backfill-policy";
import { commitExternalImportRow } from "@/lib/imports/external-commit";
import { prepareExternalImportBatch } from "@/lib/imports/external-preview";

const LOCK_TTL_MS = 3 * 60 * 1000;

export class HistoricalBackfillBusyError extends Error {
  constructor() {
    super("To zadanie historyczne jest już przetwarzane w innym żądaniu.");
    this.name = "HistoricalBackfillBusyError";
  }
}

function fixtureIds(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function errorMessages(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function jobSummary(job: {
  id: string;
  providerSeason: number;
  status: HistoricalBackfillStatus;
  fixturesTotal: number;
  fixturesProcessed: number;
  activeBatchSize: number;
  requestsUsed: number;
  importedRows: number;
  duplicateRows: number;
  invalidRows: number;
  cornersCovered: number;
  cardsCovered: number;
  shotsCovered: number;
  foulsCovered: number;
  offsidesCovered: number;
  lastError: string | null;
  season: {
    id: string;
    name: string;
    league: { id: string; name: string; code: string };
  };
}) {
  const total = Math.min(
    job.fixturesTotal,
    job.fixturesProcessed + job.activeBatchSize,
  );
  return {
    id: job.id,
    leagueId: job.season.league.id,
    leagueName: job.season.league.name,
    leagueCode: job.season.league.code,
    seasonId: job.season.id,
    seasonName: job.season.name,
    providerSeason: job.providerSeason,
    status: job.status,
    fixturesTotal: job.fixturesTotal,
    fixturesProcessed: job.fixturesProcessed,
    requestsUsed: job.requestsUsed,
    importedRows: job.importedRows,
    duplicateRows: job.duplicateRows,
    invalidRows: job.invalidRows,
    lastError: job.lastError,
    coverage: {
      corners: percentage(job.cornersCovered, total),
      cards: percentage(job.cardsCovered, total),
      shots: percentage(job.shotsCovered, total),
      fouls: percentage(job.foulsCovered, total),
      offsides: percentage(job.offsidesCovered, total),
    },
  };
}

async function loadJob(jobId: string) {
  return prisma.historicalBackfillJob.findUnique({
    where: { id: jobId },
    include: {
      season: { include: { league: true } },
    },
  });
}

export async function historicalJobSummary(jobId: string) {
  const job = await loadJob(jobId);
  return job ? jobSummary(job) : null;
}

export async function planHistoricalBackfill(input: {
  userId: string;
  leagueId: string;
  providerSeason: number;
}) {
  if (
    !Number.isInteger(input.providerSeason)
    || input.providerSeason < 2000
    || input.providerSeason > 2100
  ) {
    throw new Error("Nieprawidłowy rok sezonu API-Football.");
  }

  const league = await prisma.league.findUnique({
    where: { id: input.leagueId },
  });
  if (!league || !league.active) {
    throw new Error("Nie znaleziono aktywnej ligi.");
  }

  const providerLeagueId = API_FOOTBALL_LEAGUE_IDS[league.code];
  if (!providerLeagueId) {
    throw new Error("Ta liga nie ma mapowania API-Football.");
  }

  const existing = await prisma.historicalBackfillJob.findUnique({
    where: {
      providerCode_providerLeagueId_providerSeason: {
        providerCode: API_FOOTBALL_PROVIDER_CODE,
        providerLeagueId,
        providerSeason: input.providerSeason,
      },
    },
    include: {
      season: { include: { league: true } },
    },
  });
  if (existing) {
    return { ...jobSummary(existing), reused: true };
  }

  const fixtures = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
    league: providerLeagueId,
    season: input.providerSeason,
    timezone: "UTC",
  });
  const ids = finishedFixtureIds(fixtures);
  if (!ids.length) {
    throw new ApiFootballError(
      "API-Football nie zwróciło zakończonych meczów dla tej ligi i sezonu.",
    );
  }

  const finishedFixtures = fixtures.filter((fixture) =>
    ids.includes(fixture.fixture.id)
  );
  const dates = finishedFixtures
    .map((fixture) => new Date(fixture.fixture.date))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());
  if (!dates.length) {
    throw new Error("Dostawca nie zwrócił prawidłowych dat historycznych meczów.");
  }

  const seasonName = historicalSeasonName(input.providerSeason);
  const knownSeason = await prisma.season.findUnique({
    where: {
      leagueId_name: {
        leagueId: league.id,
        name: seasonName,
      },
    },
  });
  const season = knownSeason ?? await prisma.season.create({
    data: {
      leagueId: league.id,
      name: seasonName,
      startsAt: dates[0]!,
      endsAt: dates.at(-1)!,
      active: false,
    },
  });

  const job = await prisma.historicalBackfillJob.create({
    data: {
      seasonId: season.id,
      createdById: input.userId,
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      providerLeagueId,
      providerSeason: input.providerSeason,
      status: HistoricalBackfillStatus.READY,
      fixtureIds: ids as unknown as Prisma.InputJsonValue,
      fixturesTotal: ids.length,
      requestsUsed: 1,
    },
    include: {
      season: { include: { league: true } },
    },
  });

  return { ...jobSummary(job), reused: false };
}

async function acquireJob(jobId: string) {
  const now = new Date();
  const token = randomUUID();
  const lockedUntil = new Date(now.getTime() + LOCK_TTL_MS);

  const claimed = await prisma.historicalBackfillJob.updateMany({
    where: {
      id: jobId,
      status: { not: HistoricalBackfillStatus.COMPLETED },
      OR: [
        { lockedUntil: null },
        { lockedUntil: { lt: now } },
      ],
    },
    data: {
      lockToken: token,
      lockedUntil,
      status: HistoricalBackfillStatus.RUNNING,
      startedAt: now,
      lastError: null,
    },
  });

  if (claimed.count !== 1) throw new HistoricalBackfillBusyError();
  return token;
}

async function releaseJob(jobId: string, token: string) {
  await prisma.historicalBackfillJob.updateMany({
    where: { id: jobId, lockToken: token },
    data: { lockToken: null, lockedUntil: null },
  });
}

async function batchCounts(batchId: string) {
  const grouped = await prisma.importRow.groupBy({
    by: ["status"],
    where: { importId: batchId },
    _count: { _all: true },
  });

  const counts: Record<ImportRowStatus, number> = {
    VALID: 0,
    DUPLICATE: 0,
    INVALID: 0,
    IMPORTED: 0,
    SKIPPED: 0,
  };
  for (const item of grouped) counts[item.status] = item._count._all;
  return counts;
}

async function processActiveBatch(input: {
  userId: string;
  batchId: string;
}) {
  const batch = await prisma.importBatch.findUnique({
    where: { id: input.batchId },
    include: {
      rows: {
        where: { status: ImportRowStatus.VALID },
        orderBy: { rowNumber: "asc" },
        take: HISTORICAL_COMMIT_CHUNK_SIZE,
      },
    },
  });
  if (!batch) throw new Error("Aktywna paczka historyczna nie istnieje.");

  for (const row of batch.rows) {
    try {
      await commitExternalImportRow({
        rowId: row.id,
        batchId: batch.id,
        userId: input.userId,
        fileName: batch.fileName,
      });
    } catch (error) {
      await prisma.importRow.update({
        where: { id: row.id },
        data: {
          status: ImportRowStatus.INVALID,
          errors: [
            ...errorMessages(row.errors),
            error instanceof Error
              ? `Automatyczny backfill nie zapisał wiersza: ${error.message}`
              : "Automatyczny backfill nie zapisał wiersza.",
          ] as unknown as Prisma.InputJsonValue,
        },
      });
    }
  }

  const counts = await batchCounts(batch.id);
  const completed = counts.VALID === 0;
  const processed =
    counts.IMPORTED + counts.DUPLICATE + counts.INVALID + counts.SKIPPED;
  const completedRows =
    counts.IMPORTED + counts.DUPLICATE + counts.SKIPPED;

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      rowsValid: counts.VALID + counts.IMPORTED,
      rowsInvalid: counts.INVALID,
      rowsDuplicate: counts.DUPLICATE,
      status: completed
        ? completedRows > 0
          ? ImportStatus.COMPLETED
          : ImportStatus.FAILED
        : ImportStatus.VALIDATING,
      completedAt: completed ? new Date() : null,
    },
  });

  return {
    completed,
    imported: counts.IMPORTED,
    duplicates: counts.DUPLICATE,
    invalid: counts.INVALID,
  };
}

function batchName(input: {
  jobId: string;
  leagueName: string;
  seasonName: string;
  cursor: number;
}) {
  return [
    "Historyczny backfill API-Football",
    input.leagueName,
    input.seasonName,
    `${input.cursor + 1}`,
    input.jobId,
  ].join(" · ");
}

export async function processHistoricalBackfillStep(input: {
  jobId: string;
  userId: string;
}) {
  const token = await acquireJob(input.jobId);

  try {
    const job = await loadJob(input.jobId);
    if (!job) throw new Error("Nie znaleziono zadania historycznego.");

    if (job.activeBatchId) {
      const result = await processActiveBatch({
        userId: input.userId,
        batchId: job.activeBatchId,
      });

      if (!result.completed) {
        const current = await loadJob(job.id);
        return current ? jobSummary(current) : null;
      }

      const nextProcessed = job.fixturesProcessed + job.activeBatchSize;
      const completed = nextProcessed >= job.fixturesTotal;
      const updated = await prisma.historicalBackfillJob.update({
        where: { id: job.id },
        data: {
          cursor: job.cursor + job.activeBatchSize,
          fixturesProcessed: nextProcessed,
          activeBatchId: null,
          activeBatchSize: 0,
          importedRows: { increment: result.imported },
          duplicateRows: { increment: result.duplicates },
          invalidRows: { increment: result.invalid },
          status: completed
            ? HistoricalBackfillStatus.COMPLETED
            : HistoricalBackfillStatus.RUNNING,
          finishedAt: completed ? new Date() : null,
        },
        include: {
          season: { include: { league: true } },
        },
      });
      return jobSummary(updated);
    }

    const ids = fixtureIds(job.fixtureIds);
    if (job.cursor >= ids.length) {
      const completed = await prisma.historicalBackfillJob.update({
        where: { id: job.id },
        data: {
          status: HistoricalBackfillStatus.COMPLETED,
          fixturesProcessed: job.fixturesTotal,
          finishedAt: new Date(),
        },
        include: {
          season: { include: { league: true } },
        },
      });
      return jobSummary(completed);
    }

    const selectedIds = nextFixtureChunk(ids, job.cursor);
    const detailed = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      ids: selectedIds.join("-"),
    });
    const byId = new Map(
      detailed.map((fixture) => [fixture.fixture.id, fixture]),
    );
    const ordered = selectedIds
      .map((id) => byId.get(id))
      .filter((fixture): fixture is ApiFootballFixture => Boolean(fixture));

    if (ordered.length !== selectedIds.length) {
      throw new ApiFootballError(
        `Dostawca zwrócił ${ordered.length}/${selectedIds.length} szczegółów. Zadanie zatrzymano bez przesuwania kursora.`,
      );
    }

    const normalizedStats = ordered.map(normalizeFixtureStats);
    const coverage = historicalCoverage(normalizedStats);
    const name = batchName({
      jobId: job.id,
      leagueName: job.season.league.name,
      seasonName: job.season.name,
      cursor: job.cursor,
    });

    const batchId = await prepareExternalImportBatch({
      userId: input.userId,
      season: job.season,
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      providerName: "API-Football",
      externalLeagueId: String(job.providerLeagueId),
      batchName: name,
      matches: ordered.map((fixture, index) => ({
        externalId: String(fixture.fixture.id),
        kickoffAt: new Date(fixture.fixture.date),
        kickoffTimeKnown: true,
        round: parseRound(fixture.league.round),
        home: {
          externalId: String(fixture.teams.home.id),
          name: fixture.teams.home.name,
          country: job.season.league.country,
        },
        away: {
          externalId: String(fixture.teams.away.id),
          name: fixture.teams.away.name,
          country: job.season.league.country,
        },
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        status: normalizeFixtureStatus(fixture.fixture.status.short),
        refereeName: fixture.fixture.referee?.trim() || null,
        note: "Historyczny backfill API-Football",
        stats: normalizedStats[index]!,
      })),
    });

    const updated = await prisma.historicalBackfillJob.update({
      where: { id: job.id },
      data: {
        activeBatchId: batchId,
        activeBatchSize: selectedIds.length,
        requestsUsed: { increment: 1 },
        cornersCovered: { increment: coverage.corners },
        cardsCovered: { increment: coverage.cards },
        shotsCovered: { increment: coverage.shots },
        foulsCovered: { increment: coverage.fouls },
        offsidesCovered: { increment: coverage.offsides },
        status: HistoricalBackfillStatus.RUNNING,
      },
      include: {
        season: { include: { league: true } },
      },
    });

    return jobSummary(updated);
  } catch (error) {
    const retryable =
      error instanceof ApiFootballError
      || (error instanceof Error
        && /(timeout|limit|quota|429|network|fetch|dostawc)/i.test(error.message));
    const message = error instanceof Error
      ? error.message.slice(0, 2000)
      : "Nieznany błąd historycznego backfillu.";

    const updated = await prisma.historicalBackfillJob.update({
      where: { id: input.jobId },
      data: {
        status: retryable
          ? HistoricalBackfillStatus.PAUSED
          : HistoricalBackfillStatus.FAILED,
        lastError: message,
      },
      include: {
        season: { include: { league: true } },
      },
    }).catch(() => null);

    if (updated) return jobSummary(updated);
    throw error;
  } finally {
    await releaseJob(input.jobId, token).catch(() => undefined);
  }
}
