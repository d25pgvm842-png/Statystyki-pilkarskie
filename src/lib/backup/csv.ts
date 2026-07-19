import { kickoffInputValue } from "@/lib/matches/date-time";

export type MatchExportRow = {
  id: string;
  kickoffAt: Date;
  round: number | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  note: string | null;
  sourceExternalId: string | null;
  season: { name: string; league: { name: string; country: string } };
  homeTeam: { name: string };
  awayTeam: { name: string };
  referee: { name: string } | null;
  dataSource: { name: string } | null;
  stats: {
    homeCorners: number | null;
    awayCorners: number | null;
    homeYellowCards: number | null;
    awayYellowCards: number | null;
    homeRedCards: number | null;
    awayRedCards: number | null;
    homeShotsOnTarget: number | null;
    awayShotsOnTarget: number | null;
    homeShots: number | null;
    awayShots: number | null;
    homeFouls: number | null;
    awayFouls: number | null;
    homeOffsides: number | null;
    awayOffsides: number | null;
  } | null;
};

const headers = [
  "ID",
  "Liga",
  "Kraj",
  "Sezon",
  "Kolejka",
  "Data i godzina",
  "Status",
  "Gospodarz",
  "Gość",
  "Gole gospodarza",
  "Gole gościa",
  "Sędzia",
  "Źródło",
  "ID zewnętrzne",
  "Rożne gospodarza",
  "Rożne gościa",
  "Żółte kartki gospodarza",
  "Żółte kartki gościa",
  "Czerwone kartki gospodarza",
  "Czerwone kartki gościa",
  "Celne strzały gospodarza",
  "Celne strzały gościa",
  "Strzały gospodarza",
  "Strzały gościa",
  "Faule gospodarza",
  "Faule gościa",
  "Spalone gospodarza",
  "Spalone gościa",
  "Notatka",
] as const;

export function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (!/[;"\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildMatchesCsv(matches: MatchExportRow[]) {
  const rows = matches.map((match) => {
    const stats = match.stats;
    return [
      match.id,
      match.season.league.name,
      match.season.league.country,
      match.season.name,
      match.round,
      kickoffInputValue(match.kickoffAt).replace("T", " "),
      match.status,
      match.homeTeam.name,
      match.awayTeam.name,
      match.homeScore,
      match.awayScore,
      match.referee?.name,
      match.dataSource?.name,
      match.sourceExternalId,
      stats?.homeCorners,
      stats?.awayCorners,
      stats?.homeYellowCards,
      stats?.awayYellowCards,
      stats?.homeRedCards,
      stats?.awayRedCards,
      stats?.homeShotsOnTarget,
      stats?.awayShotsOnTarget,
      stats?.homeShots,
      stats?.awayShots,
      stats?.homeFouls,
      stats?.awayFouls,
      stats?.homeOffsides,
      stats?.awayOffsides,
      match.note,
    ].map(csvCell).join(";");
  });

  return `\uFEFF${headers.map(csvCell).join(";")}\r\n${rows.join("\r\n")}\r\n`;
}

export function exportFileDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
