import { Prisma } from "@/generated/prisma/client";
import {
  AuditEntityType,
  DataSourceType,
  ImportRowStatus,
  MatchStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  findExternalMapping,
  replaceExternalMapping,
} from "@/lib/external-mappings";
import { normalizeLookup } from "@/lib/imports/csv";
import {
  type ExternalPreparedRowData,
  type ExternalRefereeCandidate,
  type ExternalStats,
  type ExternalTeamCandidate,
} from "@/lib/imports/external-preview";
import { preferIncoming, stableMatchStatus } from "@/lib/imports/api-update-safety";
import { valueToString } from "@/lib/utils";

const statFields: Array<keyof ExternalStats> = [
  "homeCorners",
  "awayCorners",
  "homeYellowCards",
  "awayYellowCards",
  "homeRedCards",
  "awayRedCards",
  "homeShotsOnTarget",
  "awayShotsOnTarget",
  "homeShots",
  "awayShots",
  "homeFouls",
  "awayFouls",
  "homeOffsides",
  "awayOffsides",
];

type TransactionClient = Prisma.TransactionClient;

type ExistingMatch = NonNullable<Awaited<ReturnType<typeof loadLockedMatch>>>;

function storedExternalRow(value: Prisma.JsonValue): ExternalPreparedRowData {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Nieprawidłowe dane wiersza importu zewnętrznego.");
  }
  return value as unknown as ExternalPreparedRowData;
}

function inputRow(value: ExternalPreparedRowData): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function slugify(value: string, suffix?: string | null) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "encja";
  const cleanSuffix = suffix
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  return cleanSuffix ? `${base}-${cleanSuffix}` : base;
}

async function advisoryLock(tx: TransactionClient, key: string) {
  await tx.$queryRaw<Array<{ lock: string | null }>>`\n    SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "lock"\n  `;
}

async function resolveTeam(input: {
  tx: TransactionClient;
  seasonId: string;
  providerCode: string;
  directId: string | null;
  candidate?: ExternalTeamCandidate;
}) {
  const { tx, seasonId, providerCode, directId, candidate } = input;
  const lockKey = candidate?.externalId
    ? `external-team:${providerCode}:${candidate.externalId}`
    : `internal-team:${directId ?? candidate?.name ?? "unknown"}`;
  await advisoryLock(tx, lockKey);

  let team: { id: string; name: string; shortName: string | null; slug: string; country: string; active: boolean; createdAt: Date; updatedAt: Date } | null = null;

  if (candidate?.externalId) {
    const mapping = await findExternalMapping({
      providerCode,
      entityType: "TEAM",
      externalId: candidate.externalId,
    }, tx);
    if (mapping) team = await tx.team.findUnique({ where: { id: mapping.internalId } });
  }

  if (!team && directId) team = await tx.team.findUnique({ where: { id: directId } });
  if (!team && candidate?.existingId) {
    team = await tx.team.findUnique({ where: { id: candidate.existingId } });
  }

  if (!team && candidate) {
    const normalized = normalizeLookup(candidate.name);
    const allTeams = await tx.team.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        country: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    team = allTeams.find((item) =>
      normalizeLookup(item.name) === normalized
      || normalizeLookup(item.shortName ?? "") === normalized
      || normalizeLookup(item.slug) === normalized
    ) ?? null;
  }

  if (!team && candidate) {
    const slug = slugify(candidate.name, candidate.externalId);
    team = await tx.team.upsert({
      where: { slug },
      update: {
        name: candidate.name,
        shortName: candidate.shortName,
        country: candidate.country,
        active: true,
      },
      create: {
        name: candidate.name,
        shortName: candidate.shortName,
        slug,
        country: candidate.country,
        active: true,
      },
    });
  }

  if (!team) throw new Error("Nie udało się rozwiązać drużyny podczas zatwierdzania.");

  await tx.seasonTeam.upsert({
    where: { seasonId_teamId: { seasonId, teamId: team.id } },
    update: {},
    create: { seasonId, teamId: team.id },
  });

  if (candidate?.externalId) {
    await replaceExternalMapping({
      providerCode,
      entityType: "TEAM",
      internalId: team.id,
      externalId: candidate.externalId,
      externalName: candidate.name,
      metadata: {
        shortName: candidate.shortName,
        country: candidate.country,
      } as Prisma.InputJsonValue,
      active: true,
    }, tx);
  }

  return team;
}

async function resolveReferee(input: {
  tx: TransactionClient;
  seasonId: string;
  directId: string | null;
  candidate?: ExternalRefereeCandidate | null;
  name: string | null;
}) {
  const cleanName = input.candidate?.name?.trim() || input.name?.trim() || null;
  if (!cleanName && !input.directId) return null;

  await advisoryLock(input.tx, `external-referee:${normalizeLookup(cleanName ?? input.directId ?? "unknown")}`);

  let referee = input.directId
    ? await input.tx.referee.findUnique({ where: { id: input.directId } })
    : null;
  if (!referee && input.candidate?.existingId) {
    referee = await input.tx.referee.findUnique({ where: { id: input.candidate.existingId } });
  }
  if (!referee && cleanName) {
    const normalized = normalizeLookup(cleanName);
    const all = await input.tx.referee.findMany();
    referee = all.find((item) =>
      normalizeLookup(item.name) === normalized || normalizeLookup(item.slug) === normalized
    ) ?? null;
  }
  if (!referee && cleanName) {
    const slug = slugify(cleanName);
    referee = await input.tx.referee.upsert({
      where: { slug },
      update: { name: cleanName, active: true },
      create: { name: cleanName, slug, active: true },
    });
  }
  if (!referee) return null;

  await input.tx.refereeSeason.upsert({
    where: {
      refereeId_seasonId: {
        refereeId: referee.id,
        seasonId: input.seasonId,
      },
    },
    update: {},
    create: { refereeId: referee.id, seasonId: input.seasonId },
  });

  return referee;
}

async function ensureSource(input: {
  tx: TransactionClient;
  batchId: string;
  batchSourceId: string | null;
  providerCode: string;
  providerName: string;
  externalLeagueId?: string;
  seasonId: string;
}) {
  await advisoryLock(input.tx, `external-source:${input.providerCode}:${input.externalLeagueId ?? input.seasonId}`);

  const season = await input.tx.season.findUnique({
    where: { id: input.seasonId },
    include: { league: true },
  });
  if (!season) throw new Error("Sezon nie istnieje podczas zatwierdzania raportu.");

  const source = input.batchSourceId
    ? await input.tx.dataSource.findUnique({ where: { id: input.batchSourceId } })
    : null;
  const resolvedSource = source?.providerCode === input.providerCode
    ? source
    : await input.tx.dataSource.upsert({
    where: { providerCode: input.providerCode },
    update: { name: input.providerName, type: DataSourceType.API, active: true },
    create: {
      name: input.providerName,
      providerCode: input.providerCode,
      type: DataSourceType.API,
      active: true,
    },
  });

  if (input.externalLeagueId) {
    await replaceExternalMapping({
      providerCode: input.providerCode,
      entityType: "LEAGUE",
      internalId: season.leagueId,
      externalId: input.externalLeagueId,
      externalName: season.league.name,
      active: true,
    }, input.tx);
  }

  await input.tx.importBatch.update({
    where: { id: input.batchId },
    data: { sourceId: resolvedSource.id },
  });

  return resolvedSource;
}

async function loadLockedMatch(tx: TransactionClient, id: string) {
  await tx.$queryRaw`SELECT "id" FROM "Match" WHERE "id" = ${id} FOR UPDATE`;
  return tx.match.findUnique({
    where: { id },
    include: { stats: true, overrides: true },
  });
}

async function findExistingMatch(input: {
  tx: TransactionClient;
  data: ExternalPreparedRowData;
  sourceId: string;
  homeTeamId: string;
  awayTeamId: string;
}) {
  if (input.data.existingMatchId) {
    const byId = await loadLockedMatch(input.tx, input.data.existingMatchId);
    if (byId) return { match: byId, kind: "EXPECTED" as const };
  }

  if (input.data.sourceExternalId) {
    const bySource = await input.tx.match.findFirst({
      where: {
        dataSourceId: input.sourceId,
        sourceExternalId: input.data.sourceExternalId,
      },
      select: { id: true },
    });
    if (bySource) {
      const match = await loadLockedMatch(input.tx, bySource.id);
      if (match) return { match, kind: "SOURCE" as const };
    }
  }

  const kickoffAt = new Date(input.data.kickoffAt);
  const dayStart = new Date(`${kickoffAt.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  const byDay = await input.tx.match.findFirst({
    where: {
      seasonId: input.data.seasonId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      kickoffAt: { gte: dayStart, lt: dayEnd },
    },
    select: { id: true },
  });
  if (!byDay) return null;
  const match = await loadLockedMatch(input.tx, byDay.id);
  return match ? { match, kind: "DAY" as const } : null;
}

function auditValues(data: ExternalPreparedRowData, input: {
  batchId: string;
  rowId: string;
  fileName: string;
}) {
  return {
    importId: input.batchId,
    importRowId: input.rowId,
    importFileName: input.fileName,
    seasonId: data.seasonId,
    round: data.round,
    kickoffAt: data.kickoffAt,
    homeTeamId: data.homeTeamId,
    awayTeamId: data.awayTeamId,
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    status: data.status,
    refereeId: data.refereeId,
    note: data.note,
    ...data.stats,
  };
}

async function updateExistingMatch(input: {
  tx: TransactionClient;
  rowId: string;
  userId: string;
  data: ExternalPreparedRowData;
  match: ExistingMatch;
  homeTeamId: string;
  awayTeamId: string;
  refereeId: string | null;
}) {
  const locked = new Set(input.match.overrides.map((override) => override.fieldName));
  const oldValues: Record<string, unknown> = {
    round: input.match.round,
    kickoffAt: input.match.kickoffAt,
    homeTeamId: input.match.homeTeamId,
    awayTeamId: input.match.awayTeamId,
    homeScore: input.match.homeScore,
    awayScore: input.match.awayScore,
    status: input.match.status,
    refereeId: input.match.refereeId,
    ...Object.fromEntries(statFields.map((field) => [field, input.match.stats?.[field] ?? null])),
  };
  const incomingValues: Record<string, unknown> = {
    round: preferIncoming(input.match.round, input.data.round),
    kickoffAt: new Date(input.data.kickoffAt),
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    homeScore: preferIncoming(input.match.homeScore, input.data.homeScore),
    awayScore: preferIncoming(input.match.awayScore, input.data.awayScore),
    status: stableMatchStatus(input.match.status, input.data.status) as MatchStatus,
    refereeId: preferIncoming(input.match.refereeId, input.refereeId),
    ...Object.fromEntries(statFields.map((field) => [
      field,
      preferIncoming(input.match.stats?.[field] ?? null, input.data.stats[field]),
    ])),
  };

  const importedAt = new Date();
  const matchUpdate: Prisma.MatchUpdateInput = {
    sourceUpdatedAt: input.data.sourceUpdatedAt
      ? new Date(input.data.sourceUpdatedAt)
      : importedAt,
  };
  for (const field of [
    "round",
    "kickoffAt",
    "homeScore",
    "awayScore",
    "status",
    "refereeId",
  ] as const) {
    if (!locked.has(field)) (matchUpdate as Record<string, unknown>)[field] = incomingValues[field];
  }
  if (!locked.has("homeTeamId")) matchUpdate.homeTeam = { connect: { id: input.homeTeamId } };
  if (!locked.has("awayTeamId")) matchUpdate.awayTeam = { connect: { id: input.awayTeamId } };

  const statsUpdate: Record<string, number | null> = {};
  for (const field of statFields) {
    if (!locked.has(field)) statsUpdate[field] = incomingValues[field] as number | null;
  }

  await input.tx.match.update({
    where: { id: input.match.id },
    data: {
      ...matchUpdate,
      stats: {
        upsert: {
          create: input.data.stats,
          update: statsUpdate,
        },
      },
    },
  });

  const changedFields = Object.keys(incomingValues).filter(
    (field) => !locked.has(field)
      && valueToString(oldValues[field]) !== valueToString(incomingValues[field]),
  );
  if (changedFields.length) {
    await input.tx.auditLog.create({
      data: {
        entityType: AuditEntityType.MATCH,
        entityId: input.match.id,
        action: "SYNC_API_UPDATE",
        userId: input.userId,
        changes: {
          create: changedFields.map((fieldName) => ({
            fieldName,
            oldValue: valueToString(oldValues[fieldName]),
            newValue: valueToString(incomingValues[fieldName]),
          })),
        },
      },
    });
  }

  const messages: string[] = [];
  if (
    input.data.preparedMatchUpdatedAt
    && input.match.updatedAt.toISOString() !== input.data.preparedMatchUpdatedAt
  ) {
    messages.push("Mecz zmienił się po przygotowaniu raportu; użyto aktualnego stanu bazy.");
  }
  if (locked.size) messages.push(`Zachowano ${locked.size} ręcznych korekt.`);

  const nextData: ExternalPreparedRowData = {
    ...input.data,
    operation: "UPDATE",
    existingMatchId: input.match.id,
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    refereeId: input.refereeId,
    importedMatchId: input.match.id,
    duplicateMatchId: null,
    importedAt: importedAt.toISOString(),
  };
  await input.tx.importRow.update({
    where: { id: input.rowId },
    data: {
      status: ImportRowStatus.IMPORTED,
      rawData: inputRow(nextData),
      errors: messages.length
        ? messages as unknown as Prisma.InputJsonValue
        : Prisma.DbNull,
    },
  });

  return { status: "IMPORTED" as const, matchId: input.match.id };
}

async function commitOnce(input: {
  rowId: string;
  batchId: string;
  userId: string;
  fileName: string;
}) {
  return prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `import-row:${input.rowId}`);
    const row = await tx.importRow.findUnique({
      where: { id: input.rowId },
      include: { import: { include: { source: true } } },
    });
    if (!row || row.importId !== input.batchId || row.status !== ImportRowStatus.VALID) {
      return { status: "SKIPPED" as const };
    }

    const data = storedExternalRow(row.rawData);
    if (!data.provider) throw new Error("Wiersz nie jest importem zewnętrznym.");

    const source = await ensureSource({
      tx,
      batchId: input.batchId,
      batchSourceId: row.import.sourceId,
      providerCode: data.provider,
      providerName: data.providerName?.trim() || row.import.source?.name || data.provider,
      externalLeagueId: data.externalLeagueId,
      seasonId: data.seasonId,
    });

    const homeTeam = await resolveTeam({
      tx,
      seasonId: data.seasonId,
      providerCode: data.provider,
      directId: data.homeTeamId || null,
      candidate: data.homeTeamCandidate,
    });
    const awayTeam = await resolveTeam({
      tx,
      seasonId: data.seasonId,
      providerCode: data.provider,
      directId: data.awayTeamId || null,
      candidate: data.awayTeamCandidate,
    });
    if (homeTeam.id === awayTeam.id) throw new Error("Gospodarz i gość wskazują tę samą drużynę.");

    const referee = await resolveReferee({
      tx,
      seasonId: data.seasonId,
      directId: data.refereeId,
      candidate: data.refereeCandidate,
      name: data.refereeName,
    });

    const existing = await findExistingMatch({
      tx,
      data,
      sourceId: source.id,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
    });

    if (existing && existing.kind === "DAY" && data.operation !== "UPDATE") {
      const nextData: ExternalPreparedRowData = {
        ...data,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        refereeId: referee?.id ?? null,
        duplicateMatchId: existing.match.id,
      };
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          status: ImportRowStatus.DUPLICATE,
          rawData: inputRow(nextData),
          errors: [
            "Mecz pojawił się w bazie po przygotowaniu raportu. Wiersz pominięto jako duplikat.",
          ] as unknown as Prisma.InputJsonValue,
        },
      });
      return { status: "DUPLICATE" as const, matchId: existing.match.id };
    }

    if (existing) {
      return updateExistingMatch({
        tx,
        rowId: row.id,
        userId: input.userId,
        data,
        match: existing.match,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        refereeId: referee?.id ?? null,
      });
    }

    const importedAt = new Date();
    const resolvedData: ExternalPreparedRowData = {
      ...data,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      refereeId: referee?.id ?? null,
    };
    const match = await tx.match.create({
      data: {
        seasonId: resolvedData.seasonId,
        round: resolvedData.round,
        kickoffAt: new Date(resolvedData.kickoffAt),
        homeTeamId: resolvedData.homeTeamId,
        awayTeamId: resolvedData.awayTeamId,
        homeScore: resolvedData.homeScore,
        awayScore: resolvedData.awayScore,
        status: resolvedData.status,
        refereeId: resolvedData.refereeId,
        dataSourceId: source.id,
        sourceExternalId: resolvedData.sourceExternalId,
        sourceUpdatedAt: resolvedData.sourceUpdatedAt
          ? new Date(resolvedData.sourceUpdatedAt)
          : importedAt,
        note: resolvedData.note,
        stats: { create: resolvedData.stats },
      },
    });

    const values = auditValues(resolvedData, input);
    await tx.auditLog.create({
      data: {
        entityType: AuditEntityType.MATCH,
        entityId: match.id,
        action: "SYNC_API_CREATE",
        userId: input.userId,
        changes: {
          create: Object.entries(values).map(([fieldName, newValue]) => ({
            fieldName,
            oldValue: null,
            newValue: valueToString(newValue),
          })),
        },
      },
    });

    await tx.importRow.update({
      where: { id: row.id },
      data: {
        status: ImportRowStatus.IMPORTED,
        rawData: inputRow({
          ...resolvedData,
          operation: "CREATE",
          importedMatchId: match.id,
          duplicateMatchId: null,
          importedAt: importedAt.toISOString(),
        }),
        errors: Prisma.DbNull,
      },
    });

    return { status: "IMPORTED" as const, matchId: match.id };
  }, { maxWait: 10_000, timeout: 30_000 });
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

export async function commitExternalImportRow(input: {
  rowId: string;
  batchId: string;
  userId: string;
  fileName: string;
}) {
  try {
    return await commitOnce(input);
  } catch (error) {
    if (databaseErrorCode(error) === "P2002") {
      return commitOnce(input);
    }
    throw error;
  }
}
