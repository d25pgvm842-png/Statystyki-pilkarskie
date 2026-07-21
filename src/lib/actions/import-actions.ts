"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import {
  AuditEntityType,
  DataSourceType,
  ImportRowStatus,
  ImportStatus,
  MatchStatus,
} from "@/generated/prisma/enums";
import { requireWriteUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lockTransactionResource } from "@/lib/transaction-locks";
import {
  normalizeLookup,
  normalizeStatus,
  parseCsv,
  parseKickoffDate,
  parseNullableInteger,
  type CsvRecord,
} from "@/lib/imports/csv";
import { preferIncoming, stableMatchStatus } from "@/lib/imports/api-update-safety";
import { commitExternalImportRow } from "@/lib/imports/external-commit";
import type { ExternalRefereeCandidate, ExternalTeamCandidate } from "@/lib/imports/external-preview";
import { valueToString } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const IMPORT_COMMIT_CHUNK_SIZE = 5;

const statMapping = {
  home_corners: "homeCorners",
  away_corners: "awayCorners",
  home_yellow_cards: "homeYellowCards",
  away_yellow_cards: "awayYellowCards",
  home_red_cards: "homeRedCards",
  away_red_cards: "awayRedCards",
  home_shots_on_target: "homeShotsOnTarget",
  away_shots_on_target: "awayShotsOnTarget",
  home_shots: "homeShots",
  away_shots: "awayShots",
  home_fouls: "homeFouls",
  away_fouls: "awayFouls",
  home_offsides: "homeOffsides",
  away_offsides: "awayOffsides",
} as const;

type StatField = (typeof statMapping)[keyof typeof statMapping];

type StoredImportRow = {
  provider?: string;
  providerName?: string;
  externalLeagueId?: string;
  preparedMatchUpdatedAt?: string | null;
  homeTeamCandidate?: ExternalTeamCandidate;
  awayTeamCandidate?: ExternalTeamCandidate;
  refereeCandidate?: ExternalRefereeCandidate | null;
  previewActions?: string[];
  operation?: "CREATE" | "UPDATE";
  existingMatchId?: string | null;
  sourceExternalId?: string | null;
  sourceUpdatedAt?: string | null;
  seasonId: string;
  round: number | null;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  refereeId: string | null;
  refereeName: string | null;
  note: string | null;
  stats: Record<StatField, number | null>;
  importedMatchId?: string | null;
  duplicateMatchId?: string | null;
  importedAt?: string | null;
};

type ImportStatusCounts = Record<ImportRowStatus, number>;

function addLookup(
  map: Map<string, { id: string; name: string }>,
  value: string | null | undefined,
  item: { id: string; name: string },
) {
  if (!value) return;
  const key = normalizeLookup(value);
  if (key) map.set(key, item);
}

function integer(record: CsvRecord, field: string, label: string, errors: string[]) {
  const value = parseNullableInteger(record[field]);
  if (Number.isNaN(value)) {
    errors.push(`${label}: podaj liczbę całkowitą równą lub większą od zera.`);
    return null;
  }
  return value;
}

function storedRow(value: Prisma.JsonValue): StoredImportRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Nieprawidłowe dane wiersza importu.");
  }
  return value as unknown as StoredImportRow;
}

function inputRow(value: StoredImportRow): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

function messages(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function databaseErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return String((error as { code?: unknown }).code ?? "");
}

async function rowStatusCounts(client: Prisma.TransactionClient | typeof prisma, batchId: string) {
  const grouped = await client.importRow.groupBy({
    by: ["status"],
    where: { importId: batchId },
    _count: { _all: true },
  });

  const counts: ImportStatusCounts = {
    VALID: 0,
    DUPLICATE: 0,
    INVALID: 0,
    IMPORTED: 0,
    SKIPPED: 0,
  };

  for (const item of grouped) counts[item.status] = item._count._all;
  return counts;
}

async function syncBatchCounters(client: Prisma.TransactionClient | typeof prisma, batchId: string) {
  const counts = await rowStatusCounts(client, batchId);
  await client.importBatch.update({
    where: { id: batchId },
    data: {
      rowsValid: counts.VALID + counts.IMPORTED,
      rowsInvalid: counts.INVALID,
      rowsDuplicate: counts.DUPLICATE,
    },
  });
  return counts;
}

async function updateBatchCommitStatus(batchId: string) {
  return prisma.$transaction(async (tx) => {
    const counts = await syncBatchCounters(tx, batchId);
    const hasRemaining = counts.VALID > 0;
    const completed = counts.IMPORTED > 0 || counts.DUPLICATE > 0 || counts.SKIPPED > 0;

    await tx.importBatch.update({
      where: { id: batchId },
      data: {
        status: hasRemaining
          ? ImportStatus.VALIDATING
          : completed
            ? ImportStatus.COMPLETED
            : ImportStatus.FAILED,
        completedAt: hasRemaining ? null : new Date(),
      },
    });

    return counts;
  });
}

function duplicateKey(data: Pick<StoredImportRow, "homeTeamId" | "awayTeamId" | "kickoffAt" | "homeTeamName" | "awayTeamName" | "homeTeamCandidate" | "awayTeamCandidate">) {
  const home = data.homeTeamId
    || data.homeTeamCandidate?.existingId
    || data.homeTeamCandidate?.externalId
    || normalizeLookup(data.homeTeamName);
  const away = data.awayTeamId
    || data.awayTeamCandidate?.existingId
    || data.awayTeamCandidate?.externalId
    || normalizeLookup(data.awayTeamName);
  return `${home}:${away}:${data.kickoffAt}`;
}

function auditValues(data: StoredImportRow, batchId: string, rowId: string, fileName: string) {
  return {
    importId: batchId,
    importRowId: rowId,
    importFileName: fileName,
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

export async function uploadCsvImportAction(formData: FormData) {
  const user = await requireWriteUser();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const file = formData.get("file");

  if (!seasonId) redirect("/imports?error=season");
  if (!(file instanceof File) || !file.name) redirect("/imports?error=file");
  if (file.size > MAX_FILE_SIZE) redirect("/imports?error=size");
  if (!file.name.toLowerCase().endsWith(".csv")) redirect("/imports?error=type");

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: {
      league: true,
      teams: { include: { team: true } },
      refereeSeasons: { include: { referee: true } },
    },
  });
  if (!season) redirect("/imports?error=season");

  const content = await file.text();
  const parsed = parseCsv(content);
  if (!parsed.records.length) redirect("/imports?error=empty");
  if (parsed.records.length > 5000) redirect("/imports?error=rows");

  const teamLookup = new Map<string, { id: string; name: string }>();
  for (const membership of season.teams) {
    const item = { id: membership.team.id, name: membership.team.name };
    addLookup(teamLookup, membership.team.name, item);
    addLookup(teamLookup, membership.team.shortName, item);
    addLookup(teamLookup, membership.team.slug, item);
  }

  const refereeLookup = new Map<string, { id: string; name: string }>();
  for (const assignment of season.refereeSeasons) {
    const item = { id: assignment.referee.id, name: assignment.referee.name };
    addLookup(refereeLookup, assignment.referee.name, item);
    addLookup(refereeLookup, assignment.referee.slug, item);
  }

  const existingMatches = await prisma.match.findMany({
    where: { seasonId },
    select: { id: true, homeTeamId: true, awayTeamId: true, kickoffAt: true },
  });
  const databaseDuplicates = new Map(
    existingMatches.map((match) => [
      `${match.homeTeamId}:${match.awayTeamId}:${match.kickoffAt.toISOString()}`,
      match.id,
    ]),
  );
  const fileKeys = new Map<string, number>();


  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      status: ImportStatus.VALIDATING,
      createdById: user.id,
      rowsTotal: parsed.records.length,
    },
  });

  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  const rows: Prisma.ImportRowCreateManyInput[] = parsed.records.map((record, index) => {
    const rowNumber = index + 2;
    const errors: string[] = [];
    const home = teamLookup.get(normalizeLookup(record.home_team ?? ""));
    const away = teamLookup.get(normalizeLookup(record.away_team ?? ""));

    if (!home) errors.push(`Nie znaleziono gospodarza „${record.home_team || "brak"}” w wybranym sezonie.`);
    if (!away) errors.push(`Nie znaleziono gościa „${record.away_team || "brak"}” w wybranym sezonie.`);
    if (home && away && home.id === away.id) errors.push("Gospodarz i gość muszą być różnymi drużynami.");

    const kickoffAt = parseKickoffDate(record.kickoff_at);
    if (!kickoffAt) errors.push("Nieprawidłowa data lub godzina meczu.");

    const round = integer(record, "round", "Kolejka", errors);
    if (round !== null && round < 1) errors.push("Kolejka musi być większa od zera.");

    const homeScore = integer(record, "home_score", "Gole gospodarza", errors);
    const awayScore = integer(record, "away_score", "Gole gościa", errors);
    const status = normalizeStatus(record.status, homeScore !== null && awayScore !== null) as MatchStatus;

    if (status === MatchStatus.FINISHED && (homeScore === null || awayScore === null)) {
      errors.push("Zakończony mecz musi mieć pełny wynik.");
    }

    const refereeText = record.referee?.trim() ?? "";
    const referee = refereeText ? refereeLookup.get(normalizeLookup(refereeText)) : null;
    if (refereeText && !referee) errors.push(`Sędzia „${refereeText}” nie jest przypisany do wybranego sezonu.`);

    const stats = {} as Record<StatField, number | null>;
    for (const [csvField, databaseField] of Object.entries(statMapping) as [keyof typeof statMapping, StatField][]) {
      stats[databaseField] = integer(record, csvField, csvField, errors);
    }

    if (stats.homeShotsOnTarget !== null && stats.homeShots !== null && stats.homeShotsOnTarget > stats.homeShots) {
      errors.push("Celne strzały gospodarza nie mogą przekraczać wszystkich strzałów.");
    }
    if (stats.awayShotsOnTarget !== null && stats.awayShots !== null && stats.awayShotsOnTarget > stats.awayShots) {
      errors.push("Celne strzały gościa nie mogą przekraczać wszystkich strzałów.");
    }

    const note = record.note?.trim() || null;
    if (note && note.length > 2000) errors.push("Notatka może mieć maksymalnie 2000 znaków.");

    const normalized: StoredImportRow = {
      seasonId,
      round,
      kickoffAt: kickoffAt ? kickoffAt.toISOString() : "",
      homeTeamId: home?.id ?? "",
      awayTeamId: away?.id ?? "",
      homeTeamName: home?.name ?? record.home_team ?? "",
      awayTeamName: away?.name ?? record.away_team ?? "",
      homeScore,
      awayScore,
      status,
      refereeId: referee?.id ?? null,
      refereeName: referee?.name ?? (refereeText || null),
      note,
      stats,
      importedMatchId: null,
      duplicateMatchId: null,
      importedAt: null,
    };

    let rowStatus: ImportRowStatus = errors.length ? ImportRowStatus.INVALID : ImportRowStatus.VALID;
    if (!errors.length && home && away && kickoffAt) {
      const key = `${home.id}:${away.id}:${kickoffAt.toISOString()}`;
      const existingMatchId = databaseDuplicates.get(key);
      const firstRow = fileKeys.get(key);

      if (existingMatchId) {
        rowStatus = ImportRowStatus.DUPLICATE;
        normalized.duplicateMatchId = existingMatchId;
        errors.push("Taki mecz już istnieje w bazie.");
      } else if (firstRow) {
        rowStatus = ImportRowStatus.DUPLICATE;
        errors.push(`Powtórzenie w pliku. Pierwszy raz występuje w wierszu ${firstRow}.`);
      } else {
        fileKeys.set(key, rowNumber);
      }
    }

    if (rowStatus === ImportRowStatus.VALID) valid += 1;
    else if (rowStatus === ImportRowStatus.DUPLICATE) duplicate += 1;
    else invalid += 1;

    return {
      importId: batch.id,
      rowNumber,
      status: rowStatus,
      rawData: inputRow(normalized),
      errors: errors.length ? (errors as unknown as Prisma.InputJsonValue) : undefined,
    };
  });

  await prisma.$transaction([
    prisma.importRow.createMany({ data: rows }),
    prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: valid > 0 ? ImportStatus.READY : ImportStatus.FAILED,
        rowsValid: valid,
        rowsInvalid: invalid,
        rowsDuplicate: duplicate,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/imports");
  redirect(`/imports/${batch.id}`);
}

export async function toggleImportRowAction(formData: FormData) {
  await requireWriteUser();
  const batchId = String(formData.get("batchId") ?? "").trim();
  const rowId = String(formData.get("rowId") ?? "").trim();
  const target = String(formData.get("target") ?? "").trim();
  if (!batchId || !rowId || !["VALID", "SKIPPED"].includes(target)) redirect("/imports");

  const row = await prisma.importRow.findUnique({
    where: { id: rowId },
    include: { import: { select: { id: true, status: true } } },
  });
  if (!row || row.importId !== batchId || row.import.status !== ImportStatus.READY) {
    redirect(`/imports/${batchId}?error=state`);
  }

  if (target === "SKIPPED") {
    if (row.status !== ImportRowStatus.VALID) redirect(`/imports/${batchId}?error=row`);
    await prisma.$transaction(async (tx) => {
      await tx.importRow.update({ where: { id: rowId }, data: { status: ImportRowStatus.SKIPPED } });
      await syncBatchCounters(tx, batchId);
    });
  } else {
    if (row.status !== ImportRowStatus.SKIPPED) redirect(`/imports/${batchId}?error=row`);
    const data = storedRow(row.rawData);

    const existing = data.operation === "UPDATE" && data.sourceExternalId
      ? null
      : await prisma.match.findUnique({
          where: {
            seasonId_homeTeamId_awayTeamId_kickoffAt: {
              seasonId: data.seasonId,
              homeTeamId: data.homeTeamId,
              awayTeamId: data.awayTeamId,
              kickoffAt: new Date(data.kickoffAt),
            },
          },
          select: { id: true },
        });

    const siblingRows = await prisma.importRow.findMany({
      where: {
        importId: batchId,
        id: { not: rowId },
        status: { in: [ImportRowStatus.VALID, ImportRowStatus.IMPORTED] },
      },
      select: { rowNumber: true, rawData: true },
    });
    const sibling = siblingRows.find((item) => duplicateKey(storedRow(item.rawData)) === duplicateKey(data));

    await prisma.$transaction(async (tx) => {
      if (existing || sibling) {
        const nextData = { ...data, duplicateMatchId: existing?.id ?? null };
        const nextMessages = existing
          ? ["Taki mecz pojawił się już w bazie po utworzeniu podglądu importu."]
          : [`Taki mecz jest już aktywny w wierszu ${sibling?.rowNumber}.`];
        await tx.importRow.update({
          where: { id: rowId },
          data: {
            status: ImportRowStatus.DUPLICATE,
            rawData: inputRow(nextData),
            errors: nextMessages as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await tx.importRow.update({
          where: { id: rowId },
          data: { status: ImportRowStatus.VALID, errors: Prisma.DbNull },
        });
      }
      await syncBatchCounters(tx, batchId);
    });
  }

  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
  redirect(`/imports/${batchId}`);
}

export async function cancelCsvImportAction(formData: FormData) {
  await requireWriteUser();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) redirect("/imports");

  const imported = await prisma.importRow.count({
    where: { importId: batchId, status: ImportRowStatus.IMPORTED },
  });
  if (imported > 0) redirect(`/imports/${batchId}?error=imported`);

  await prisma.$transaction(async (tx) => {
    await tx.importRow.updateMany({
      where: { importId: batchId, status: ImportRowStatus.VALID },
      data: { status: ImportRowStatus.SKIPPED },
    });
    await tx.importBatch.update({
      where: { id: batchId },
      data: { status: ImportStatus.FAILED, completedAt: new Date() },
    });
    await syncBatchCounters(tx, batchId);
  });

  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
  redirect(`/imports/${batchId}?ok=cancelled`);
}

export type ImportChunkResult = {
  batchId: string;
  status: "VALIDATING" | "COMPLETED" | "FAILED";
  remaining: number;
  imported: number;
  duplicates: number;
  invalid: number;
  skipped: number;
  processed: number;
  total: number;
  completed: boolean;
};

function buildImportChunkResult(
  batchId: string,
  total: number,
  counts: ImportStatusCounts,
): ImportChunkResult {
  const processed = counts.IMPORTED + counts.DUPLICATE + counts.INVALID + counts.SKIPPED;
  const completedRows = counts.IMPORTED + counts.DUPLICATE + counts.SKIPPED;
  const status: ImportChunkResult["status"] = counts.VALID > 0
    ? "VALIDATING"
    : completedRows > 0
      ? "COMPLETED"
      : "FAILED";
  return {
    batchId,
    status,
    remaining: counts.VALID,
    imported: counts.IMPORTED,
    duplicates: counts.DUPLICATE,
    invalid: counts.INVALID,
    skipped: counts.SKIPPED,
    processed,
    total,
    completed: counts.VALID === 0,
  };
}

function revalidateImportViews(batchId: string) {
  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/teams");
  revalidatePath("/referees");
  revalidatePath("/comparison");
  revalidatePath("/trends");
  revalidatePath("/automation");
  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
}

async function processCsvImportChunk(input: {
  userId: string;
  batchId: string;
}): Promise<ImportChunkResult> {
  const user = { id: input.userId };
  const batchId = input.batchId.trim();
  if (!batchId) throw new Error("Brakuje identyfikatora importu.");

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      source: true,
      rows: {
        where: { status: ImportRowStatus.VALID },
        orderBy: { rowNumber: "asc" },
        take: IMPORT_COMMIT_CHUNK_SIZE,
      },
    },
  });

  if (!batch || (batch.status !== ImportStatus.READY && batch.status !== ImportStatus.VALIDATING)) {
    throw new Error("Import nie jest gotowy do uruchomienia lub wznowienia.");
  }
  if (!batch.rows.length) {
    const counts = await updateBatchCommitStatus(batch.id);
    revalidateImportViews(batch.id);
    return buildImportChunkResult(batch.id, batch.rowsTotal, counts);
  }

  if (batch.status === ImportStatus.READY) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: ImportStatus.VALIDATING, completedAt: null },
    });
  }

  for (const row of batch.rows) {
    const data = storedRow(row.rawData);

    if (data.provider) {
      try {
        await commitExternalImportRow({
          rowId: row.id,
          batchId: batch.id,
          userId: user.id,
          fileName: batch.fileName,
        });
      } catch (error) {
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: ImportRowStatus.INVALID,
            errors: [
              ...messages(row.errors),
              error instanceof Error
                ? `Nie udało się atomowo zatwierdzić wiersza: ${error.message}`
                : "Nie udało się atomowo zatwierdzić wiersza.",
            ] as unknown as Prisma.InputJsonValue,
          },
        });
      }
      continue;
    }

    const isApi = batch.source?.type === DataSourceType.API || data.provider === "api-football";
    const sourceExternalId = isApi
      ? data.sourceExternalId ?? null
      : `csv:${batch.id}:${row.id}`;

    try {
      const apiExistingId = isApi
        ? data.existingMatchId
          ? (await prisma.match.findUnique({
              where: { id: data.existingMatchId },
              select: { id: true },
            }))?.id ?? null
          : batch.sourceId && sourceExternalId
            ? (await prisma.match.findFirst({
                where: {
                  dataSourceId: batch.sourceId,
                  sourceExternalId,
                },
                select: { id: true },
              }))?.id ?? null
            : null
        : null;

      if (apiExistingId) {
        await prisma.$transaction(async (tx) => {
          await lockTransactionResource(tx, "match", apiExistingId);
          const apiExisting = await tx.match.findUnique({
            where: { id: apiExistingId },
            include: { stats: true, overrides: true },
          });
          if (!apiExisting) throw new Error("Mecz zniknął przed zatwierdzeniem importu.");

          const importedAt = new Date();
          const locked = new Set(apiExisting.overrides.map((override) => override.fieldName));
          const oldValues: Record<string, unknown> = {
            round: apiExisting.round,
            kickoffAt: apiExisting.kickoffAt,
            homeTeamId: apiExisting.homeTeamId,
            awayTeamId: apiExisting.awayTeamId,
            homeScore: apiExisting.homeScore,
            awayScore: apiExisting.awayScore,
            status: apiExisting.status,
            refereeId: apiExisting.refereeId,
            ...Object.fromEntries(Object.values(statMapping).map((field) => [field, apiExisting.stats?.[field] ?? null])),
          };
          const incomingValues: Record<string, unknown> = {
            round: preferIncoming(apiExisting.round, data.round),
            kickoffAt: new Date(data.kickoffAt),
            homeTeamId: data.homeTeamId,
            awayTeamId: data.awayTeamId,
            homeScore: preferIncoming(apiExisting.homeScore, data.homeScore),
            awayScore: preferIncoming(apiExisting.awayScore, data.awayScore),
            status: stableMatchStatus(apiExisting.status, data.status) as MatchStatus,
            refereeId: preferIncoming(apiExisting.refereeId, data.refereeId),
            ...Object.fromEntries(
              Object.values(statMapping).map((field) => [
                field,
                preferIncoming(apiExisting.stats?.[field] ?? null, data.stats[field]),
              ]),
            ),
          };

          const matchUpdate: Prisma.MatchUpdateInput = {
            sourceUpdatedAt: data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt) : importedAt,
          };
          for (const field of [
            "round",
            "kickoffAt",
            "homeScore",
            "awayScore",
            "status",
            "refereeId",
          ] as const) {
            if (!locked.has(field)) {
              (matchUpdate as Record<string, unknown>)[field] = incomingValues[field];
            }
          }
          if (!locked.has("homeTeamId")) matchUpdate.homeTeam = { connect: { id: data.homeTeamId } };
          if (!locked.has("awayTeamId")) matchUpdate.awayTeam = { connect: { id: data.awayTeamId } };

          const statsUpdate: Record<string, number | null> = {};
          for (const field of Object.values(statMapping)) {
            if (!locked.has(field)) statsUpdate[field] = incomingValues[field] as number | null;
          }

          await tx.match.update({
            where: { id: apiExisting.id },
            data: {
              ...matchUpdate,
              stats: {
                upsert: {
                  create: data.stats,
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
            await tx.auditLog.create({
              data: {
                entityType: AuditEntityType.MATCH,
                entityId: apiExisting.id,
                action: "SYNC_API_UPDATE",
                userId: user.id,
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

          await tx.importRow.update({
            where: { id: row.id },
            data: {
              status: ImportRowStatus.IMPORTED,
              rawData: inputRow({
                ...data,
                operation: "UPDATE",
                existingMatchId: apiExisting.id,
                importedMatchId: apiExisting.id,
                duplicateMatchId: null,
                importedAt: importedAt.toISOString(),
              }),
              errors: locked.size
                ? ([`Zachowano ${locked.size} ręcznych korekt.`] as unknown as Prisma.InputJsonValue)
                : Prisma.DbNull,
            },
          });
        });
        continue;
      }

      const duplicateMatch = await prisma.match.findUnique({
        where: {
          seasonId_homeTeamId_awayTeamId_kickoffAt: {
            seasonId: data.seasonId,
            homeTeamId: data.homeTeamId,
            awayTeamId: data.awayTeamId,
            kickoffAt: new Date(data.kickoffAt),
          },
        },
        select: { id: true },
      });

      if (duplicateMatch) {
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: ImportRowStatus.DUPLICATE,
            rawData: inputRow({ ...data, duplicateMatchId: duplicateMatch.id }),
            errors: ["Taki mecz już istnieje w bazie."] as unknown as Prisma.InputJsonValue,
          },
        });
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const importedAt = new Date();
        const csvSource = await tx.dataSource.upsert({
          where: { providerCode: "csv-import" },
          update: { name: "Import CSV", type: DataSourceType.CSV, active: true },
          create: { name: "Import CSV", providerCode: "csv-import", type: DataSourceType.CSV },
        });
        await tx.importBatch.update({
          where: { id: batch.id },
          data: { sourceId: csvSource.id },
        });
        const match = await tx.match.create({
          data: {
            seasonId: data.seasonId,
            round: data.round,
            kickoffAt: new Date(data.kickoffAt),
            homeTeamId: data.homeTeamId,
            awayTeamId: data.awayTeamId,
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            status: data.status,
            refereeId: data.refereeId,
            dataSourceId: csvSource.id,
            sourceExternalId,
            sourceUpdatedAt: data.sourceUpdatedAt ? new Date(data.sourceUpdatedAt) : importedAt,
            note: data.note,
            stats: { create: data.stats },
          },
        });

        const values = auditValues(data, batch.id, row.id, batch.fileName);
        await tx.auditLog.create({
          data: {
            entityType: AuditEntityType.MATCH,
            entityId: match.id,
            action: isApi ? "SYNC_API_CREATE" : "IMPORT_CSV",
            userId: user.id,
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
              ...data,
              operation: "CREATE",
              importedMatchId: match.id,
              duplicateMatchId: null,
              importedAt: importedAt.toISOString(),
            }),
            errors: Prisma.DbNull,
          },
        });
      });
    } catch (error) {
      if (databaseErrorCode(error) === "P2002") {
        const duplicate = await prisma.match.findFirst({
          where: {
            OR: [
              {
                seasonId: data.seasonId,
                homeTeamId: data.homeTeamId,
                awayTeamId: data.awayTeamId,
                kickoffAt: new Date(data.kickoffAt),
              },
              ...(batch.sourceId && sourceExternalId
                ? [{ dataSourceId: batch.sourceId, sourceExternalId }]
                : []),
            ],
          },
          select: { id: true },
        });
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: ImportRowStatus.DUPLICATE,
            rawData: inputRow({ ...data, duplicateMatchId: duplicate?.id ?? null }),
            errors: ["Duplikat wykryty podczas zapisu do bazy."] as unknown as Prisma.InputJsonValue,
          },
        });
      } else {
        await prisma.importRow.update({
          where: { id: row.id },
          data: {
            status: ImportRowStatus.INVALID,
            errors: [
              ...messages(row.errors),
              "Nie udało się zapisać tego wiersza. Pozostałe poprawne mecze zostały przetworzone.",
            ] as unknown as Prisma.InputJsonValue,
          },
        });
      }
    }
  }

  const counts = await updateBatchCommitStatus(batch.id);
  revalidateImportViews(batch.id);
  return buildImportChunkResult(batch.id, batch.rowsTotal, counts);
}

export async function commitCsvImportChunkAction(batchId: string): Promise<ImportChunkResult> {
  const user = await requireWriteUser();
  return processCsvImportChunk({ userId: user.id, batchId });
}

export async function commitCsvImportAction(formData: FormData) {
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) redirect("/imports");
  const result = await commitCsvImportChunkAction(batchId);
  if (!result.completed) redirect(`/imports/${batchId}?run=1`);
  redirect(`/imports/${batchId}?ok=${result.imported > 0 ? "completed" : "processed"}`);
}
