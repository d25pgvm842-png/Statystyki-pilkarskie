"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import {
  AuditEntityType,
  DataSourceType,
  ImportRowStatus,
  ImportStatus,
  MatchStatus,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  normalizeLookup,
  normalizeStatus,
  parseCsv,
  parseKickoffDate,
  parseNullableInteger,
  type CsvRecord,
} from "@/lib/imports/csv";
import { valueToString } from "@/lib/utils";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

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
};

function addLookup(map: Map<string, { id: string; name: string }>, value: string | null | undefined, item: { id: string; name: string }) {
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

export async function uploadCsvImportAction(formData: FormData) {
  const user = await requireUser();
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
    select: { homeTeamId: true, awayTeamId: true, kickoffAt: true },
  });
  const duplicateKeys = new Set(
    existingMatches.map((match) => `${match.homeTeamId}:${match.awayTeamId}:${match.kickoffAt.toISOString()}`),
  );
  const fileKeys = new Set<string>();

  const source = await prisma.dataSource.upsert({
    where: { providerCode: "csv-import" },
    update: { name: "Import CSV", type: DataSourceType.CSV, active: true },
    create: { name: "Import CSV", providerCode: "csv-import", type: DataSourceType.CSV },
  });

  const batch = await prisma.importBatch.create({
    data: {
      fileName: file.name,
      status: ImportStatus.VALIDATING,
      sourceId: source.id,
      createdById: user.id,
      rowsTotal: parsed.records.length,
    },
  });

  let valid = 0;
  let invalid = 0;
  let duplicate = 0;

  const rows: Prisma.ImportRowCreateManyInput[] = parsed.records.map((record, index) => {
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

    if (
      stats.homeShotsOnTarget !== null &&
      stats.homeShots !== null &&
      stats.homeShotsOnTarget > stats.homeShots
    ) {
      errors.push("Celne strzały gospodarza nie mogą przekraczać wszystkich strzałów.");
    }
    if (
      stats.awayShotsOnTarget !== null &&
      stats.awayShots !== null &&
      stats.awayShotsOnTarget > stats.awayShots
    ) {
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
    };

    let rowStatus: ImportRowStatus = errors.length ? ImportRowStatus.INVALID : ImportRowStatus.VALID;
    if (!errors.length && home && away && kickoffAt) {
      const key = `${home.id}:${away.id}:${kickoffAt.toISOString()}`;
      if (duplicateKeys.has(key) || fileKeys.has(key)) {
        rowStatus = ImportRowStatus.DUPLICATE;
      } else {
        fileKeys.add(key);
      }
    }

    if (rowStatus === ImportRowStatus.VALID) valid += 1;
    else if (rowStatus === ImportRowStatus.DUPLICATE) duplicate += 1;
    else invalid += 1;

    return {
      importId: batch.id,
      rowNumber: index + 2,
      status: rowStatus,
      rawData: normalized as unknown as Prisma.InputJsonValue,
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

export async function commitCsvImportAction(formData: FormData) {
  const user = await requireUser();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) redirect("/imports");

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: {
        where: { status: ImportRowStatus.VALID },
        orderBy: { rowNumber: "asc" },
      },
    },
  });

  if (!batch || batch.status !== ImportStatus.READY) redirect(`/imports/${batchId}?error=state`);

  let imported = 0;
  let duplicate = batch.rowsDuplicate;

  for (const row of batch.rows) {
    const data = storedRow(row.rawData);
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
        data: { status: ImportRowStatus.DUPLICATE },
      });
      duplicate += 1;
      continue;
    }

    await prisma.$transaction(async (tx) => {
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
          dataSourceId: batch.sourceId,
          note: data.note,
          stats: { create: data.stats },
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: AuditEntityType.MATCH,
          entityId: match.id,
          action: "IMPORT_CSV",
          userId: user.id,
          changes: {
            create: [
              { fieldName: "importId", oldValue: null, newValue: batch.id },
              { fieldName: "kickoffAt", oldValue: null, newValue: data.kickoffAt },
              { fieldName: "homeTeamId", oldValue: null, newValue: data.homeTeamId },
              { fieldName: "awayTeamId", oldValue: null, newValue: data.awayTeamId },
              { fieldName: "status", oldValue: null, newValue: valueToString(data.status) },
            ],
          },
        },
      });

      await tx.importRow.update({
        where: { id: row.id },
        data: { status: ImportRowStatus.IMPORTED },
      });
    });
    imported += 1;
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      status: ImportStatus.COMPLETED,
      rowsValid: imported,
      rowsDuplicate: duplicate,
      completedAt: new Date(),
    },
  });

  revalidatePath("/");
  revalidatePath("/matches");
  revalidatePath("/imports");
  revalidatePath(`/imports/${batch.id}`);
  redirect(`/imports/${batch.id}?ok=completed`);
}
