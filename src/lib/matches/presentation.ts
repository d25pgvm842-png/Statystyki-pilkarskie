export const MATCH_STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Zaplanowany",
  LIVE: "Trwa",
  FINISHED: "Zakończony",
  POSTPONED: "Przełożony",
  CANCELLED: "Odwołany",
};

export const MATCH_STATUS_CLASSES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  LIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  FINISHED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  POSTPONED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export const MATCH_FIELD_LABELS: Record<string, string> = {
  seasonId: "Sezon",
  round: "Kolejka",
  kickoffAt: "Data i godzina",
  homeTeamId: "Gospodarz",
  awayTeamId: "Gość",
  homeScore: "Gole gospodarza",
  awayScore: "Gole gościa",
  status: "Status",
  refereeId: "Sędzia",
  note: "Notatka",
  homeCorners: "Rożne gospodarza",
  awayCorners: "Rożne gościa",
  homeYellowCards: "Żółte kartki gospodarza",
  awayYellowCards: "Żółte kartki gościa",
  homeRedCards: "Czerwone kartki gospodarza",
  awayRedCards: "Czerwone kartki gościa",
  homeShotsOnTarget: "Celne strzały gospodarza",
  awayShotsOnTarget: "Celne strzały gościa",
  homeShots: "Strzały gospodarza",
  awayShots: "Strzały gościa",
  homeFouls: "Faule gospodarza",
  awayFouls: "Faule gościa",
  homeOffsides: "Spalone gospodarza",
  awayOffsides: "Spalone gościa",
};
