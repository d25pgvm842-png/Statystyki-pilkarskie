export const IMPORT_COLUMNS = [
  "round",
  "kickoff_at",
  "home_team",
  "away_team",
  "home_score",
  "away_score",
  "status",
  "referee",
  "home_corners",
  "away_corners",
  "home_yellow_cards",
  "away_yellow_cards",
  "home_red_cards",
  "away_red_cards",
  "home_shots_on_target",
  "away_shots_on_target",
  "home_shots",
  "away_shots",
  "home_fouls",
  "away_fouls",
  "home_offsides",
  "away_offsides",
  "note",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type CsvRecord = Record<string, string>;

const HEADER_ALIASES: Record<string, ImportColumn | "date" | "time"> = {
  round: "round",
  kolejka: "round",
  matchday: "round",

  kickoff_at: "kickoff_at",
  kickoff: "kickoff_at",
  datetime: "kickoff_at",
  date_time: "kickoff_at",
  termin: "kickoff_at",

  date: "date",
  data: "date",
  time: "time",
  godzina: "time",

  home_team: "home_team",
  hometeam: "home_team",
  home: "home_team",
  gospodarz: "home_team",
  gospodarze: "home_team",

  away_team: "away_team",
  awayteam: "away_team",
  away: "away_team",
  gosc: "away_team",
  goscie: "away_team",

  home_score: "home_score",
  fthg: "home_score",
  hg: "home_score",
  gole_gospodarzy: "home_score",

  away_score: "away_score",
  ftag: "away_score",
  ag: "away_score",
  gole_gosci: "away_score",

  status: "status",
  referee: "referee",
  sedzia: "referee",

  home_corners: "home_corners",
  hc: "home_corners",
  rozne_gospodarzy: "home_corners",

  away_corners: "away_corners",
  ac: "away_corners",
  rozne_gosci: "away_corners",

  home_yellow_cards: "home_yellow_cards",
  hy: "home_yellow_cards",
  zolte_gospodarzy: "home_yellow_cards",

  away_yellow_cards: "away_yellow_cards",
  ay: "away_yellow_cards",
  zolte_gosci: "away_yellow_cards",

  home_red_cards: "home_red_cards",
  hr: "home_red_cards",
  czerwone_gospodarzy: "home_red_cards",

  away_red_cards: "away_red_cards",
  ar: "away_red_cards",
  czerwone_gosci: "away_red_cards",

  home_shots_on_target: "home_shots_on_target",
  hst: "home_shots_on_target",
  celne_gospodarzy: "home_shots_on_target",

  away_shots_on_target: "away_shots_on_target",
  ast: "away_shots_on_target",
  celne_gosci: "away_shots_on_target",

  home_shots: "home_shots",
  hs: "home_shots",
  strzaly_gospodarzy: "home_shots",

  away_shots: "away_shots",
  as: "away_shots",
  strzaly_gosci: "away_shots",

  home_fouls: "home_fouls",
  hf: "home_fouls",
  faule_gospodarzy: "home_fouls",

  away_fouls: "away_fouls",
  af: "away_fouls",
  faule_gosci: "away_fouls",

  home_offsides: "home_offsides",
  ho: "home_offsides",
  spalone_gospodarzy: "home_offsides",

  away_offsides: "away_offsides",
  ao: "away_offsides",
  spalone_gosci: "away_offsides",

  note: "note",
  notes: "note",
  uwagi: "note",
  komentarz: "note",
};

export function normalizeLookup(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeHeader(value: string) {
  return normalizeLookup(value.replace(/^\uFEFF/, "")).replace(/\s+/g, "_");
}

function countDelimiter(line: string, delimiter: string) {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && char === delimiter) {
      count += 1;
    }
  }
  return count;
}

export function detectDelimiter(content: string) {
  const firstNonEmptyLine = content
    .split(/\r?\n/)
    .find((line) => line.trim().length > 0) ?? "";

  const candidates = [";", ",", "\t"] as const;
  return candidates
    .map((delimiter) => ({ delimiter, count: countDelimiter(firstNonEmptyLine, delimiter) }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ";";
}

function parseRows(content: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      if (quoted && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (!quoted && char === delimiter) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field.trim());
      field = "";

      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

export function parseCsv(content: string) {
  const delimiter = detectDelimiter(content);
  const rows = parseRows(content, delimiter);
  if (!rows.length) return { delimiter, headers: [] as string[], records: [] as CsvRecord[] };

  const rawHeaders = rows[0].map(normalizeHeader);
  const headers = rawHeaders.map((header) => HEADER_ALIASES[header] ?? header);

  const records = rows.slice(1).map((values) => {
    const record: CsvRecord = {};
    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    if (!record.kickoff_at && record.date) {
      record.kickoff_at = `${record.date}${record.time ? ` ${record.time}` : ""}`.trim();
    }

    return record;
  });

  return { delimiter, headers, records };
}


export function parseKickoffDate(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const european = trimmed.match(
    /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/,
  );

  if (european) {
    const [, dayText, monthText, yearText, hourText = "0", minuteText = "0"] = european;
    const day = Number(dayText);
    const month = Number(monthText);
    const year = Number(yearText);
    const hour = Number(hourText);
    const minute = Number(minuteText);
    const date = new Date(year, month - 1, day, hour, minute);

    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute
    ) {
      return date;
    }
    return null;
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseNullableInteger(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  const normalized = trimmed.replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isInteger(numeric) || numeric < 0) return Number.NaN;
  return numeric;
}

export function normalizeStatus(value: string | undefined, hasScore: boolean) {
  const normalized = normalizeLookup(value ?? "").replace(/\s+/g, "_");

  const aliases: Record<string, "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED" | "CANCELLED"> = {
    scheduled: "SCHEDULED",
    zaplanowany: "SCHEDULED",
    zaplanowany_mecz: "SCHEDULED",
    live: "LIVE",
    trwa: "LIVE",
    finished: "FINISHED",
    zakonczony: "FINISHED",
    final: "FINISHED",
    postponed: "POSTPONED",
    przelozony: "POSTPONED",
    cancelled: "CANCELLED",
    canceled: "CANCELLED",
    odwolany: "CANCELLED",
  };

  return aliases[normalized] ?? (hasScore ? "FINISHED" : "SCHEDULED");
}
