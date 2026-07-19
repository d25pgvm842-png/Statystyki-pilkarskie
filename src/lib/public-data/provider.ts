import { MatchStatus } from "@/generated/prisma/enums";

export const FOOTBALL_DATA_ORG_PROVIDER_CODE = "football-data-org";
export const FOOTBALL_DATA_UK_PROVIDER_CODE = "football-data-co-uk";
export const OPEN_FOOTBALL_PROVIDER_CODE = "openfootball";

export const PUBLIC_PROVIDER_CODES = [
  FOOTBALL_DATA_ORG_PROVIDER_CODE,
  FOOTBALL_DATA_UK_PROVIDER_CODE,
  OPEN_FOOTBALL_PROVIDER_CODE,
] as const;

export const FOOTBALL_DATA_ORG_COMPETITIONS: Record<string, string> = {
  ENG1: "PL",
  ESP1: "PD",
  ITA1: "SA",
  GER1: "BL1",
  FRA1: "FL1",
};

export const FOOTBALL_DATA_UK_CODES: Record<string, string> = {
  ENG1: "E0",
  ESP1: "SP1",
  ITA1: "I1",
  GER1: "D1",
  FRA1: "F1",
  PL1: "POL",
};

export const OPEN_FOOTBALL_FILES: Record<string, string> = {
  ENG1: "en.1.json",
  ESP1: "es.1.json",
  ITA1: "it.1.json",
  GER1: "de.1.json",
  FRA1: "fr.1.json",
};

export function seasonStartYear(startsAt: Date) {
  return startsAt.getUTCFullYear();
}

export function seasonFolder(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function seasonLabel(startYear: number) {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function footballDataOrgCompetitionCode(leagueCode: string) {
  return FOOTBALL_DATA_ORG_COMPETITIONS[leagueCode] ?? null;
}

export function footballDataUkUrl(leagueCode: string, startYear: number) {
  const code = FOOTBALL_DATA_UK_CODES[leagueCode];
  if (!code) return null;
  if (leagueCode === "PL1") {
    return "https://www.football-data.co.uk/new/POL.csv";
  }

  const shortSeason = `${String(startYear).slice(-2)}${String(startYear + 1).slice(-2)}`;
  return `https://www.football-data.co.uk/mmz4281/${shortSeason}/${code}.csv`;
}

export function openFootballUrl(leagueCode: string, startYear: number) {
  const file = OPEN_FOOTBALL_FILES[leagueCode];
  if (!file) return null;
  return `https://raw.githubusercontent.com/openfootball/football.json/master/${seasonFolder(startYear)}/${file}`;
}

export function parsePublicRound(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  const match = String(value ?? "").match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizePublicStatus(value: string | null | undefined, hasScore: boolean) {
  switch (String(value ?? "").toUpperCase()) {
    case "LIVE":
    case "IN_PLAY":
    case "PAUSED":
      return MatchStatus.LIVE;
    case "FINISHED":
      return MatchStatus.FINISHED;
    case "POSTPONED":
    case "SUSPENDED":
      return MatchStatus.POSTPONED;
    case "CANCELLED":
    case "CANCELED":
      return MatchStatus.CANCELLED;
    default:
      return hasScore ? MatchStatus.FINISHED : MatchStatus.SCHEDULED;
  }
}

export function parseFootballDataKickoff(
  dateValue: string | null | undefined,
  timeValue: string | null | undefined,
) {
  const dateText = String(dateValue ?? "").trim();
  const timeText = String(timeValue ?? "").trim();
  const match = dateText.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = rawYear < 100 ? 2000 + rawYear : rawYear;
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
    || date.getUTCHours() !== hour
    || date.getUTCMinutes() !== minute
  ) {
    return null;
  }

  return date;
}
