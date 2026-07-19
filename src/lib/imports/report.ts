import type { Prisma } from "@/generated/prisma/client";

export type ImportReportRow = {
  rowNumber: number;
  status: string;
  rawData: Prisma.JsonValue;
  errors: Prisma.JsonValue | null;
};

type StoredReportData = {
  round?: number | null;
  kickoffAt?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  refereeName?: string | null;
  importedMatchId?: string | null;
  duplicateMatchId?: string | null;
  operation?: "CREATE" | "UPDATE";
  existingMatchId?: string | null;
  sourceExternalId?: string | null;
};

export function importRowData(value: Prisma.JsonValue): StoredReportData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as StoredReportData;
}

export function importRowMessages(value: Prisma.JsonValue | null) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export function countImportRowStatuses(rows: Array<{ status: string }>) {
  const counts = {
    VALID: 0,
    DUPLICATE: 0,
    INVALID: 0,
    IMPORTED: 0,
    SKIPPED: 0,
  };

  for (const row of rows) {
    if (row.status in counts) counts[row.status as keyof typeof counts] += 1;
  }

  return counts;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildImportReportCsv(rows: ImportReportRow[]) {
  const header = [
    "row_number",
    "status",
    "round",
    "kickoff_at",
    "home_team",
    "away_team",
    "home_score",
    "away_score",
    "referee",
    "imported_match_id",
    "duplicate_match_id",
    "messages",
  ];

  const lines = rows.map((row) => {
    const data = importRowData(row.rawData);
    return [
      row.rowNumber,
      row.status,
      data.round,
      data.kickoffAt,
      data.homeTeamName,
      data.awayTeamName,
      data.homeScore,
      data.awayScore,
      data.refereeName,
      data.importedMatchId,
      data.duplicateMatchId,
      importRowMessages(row.errors).join(" | "),
    ].map(csvCell).join(";");
  });

  return `\uFEFF${header.map(csvCell).join(";")}\r\n${lines.join("\r\n")}\r\n`;
}
