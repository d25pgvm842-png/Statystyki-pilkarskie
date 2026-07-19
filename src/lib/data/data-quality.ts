import type {
  DataSource,
  League,
  Match,
  MatchStats,
  Season,
  Team,
} from "@/generated/prisma/client";

export type QualityIssue = {
  key: string;
  severity: "error" | "warning";
  type: string;
  message: string;
  matchId: string;
  matchLabel: string;
  leagueSeason: string;
};

export type QualityMatch = Match & {
  stats: MatchStats | null;
  season: Season & { league: League };
  homeTeam: Team;
  awayTeam: Team;
  dataSource?: DataSource | null;
};

const statFields = [
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
] as const;

export type StatField = (typeof statFields)[number];

const statLabels: Record<StatField, string> = {
  homeCorners: "rożne gospodarzy",
  awayCorners: "rożne gości",
  homeYellowCards: "żółte kartki gospodarzy",
  awayYellowCards: "żółte kartki gości",
  homeRedCards: "czerwone kartki gospodarzy",
  awayRedCards: "czerwone kartki gości",
  homeShotsOnTarget: "celne strzały gospodarzy",
  awayShotsOnTarget: "celne strzały gości",
  homeShots: "strzały gospodarzy",
  awayShots: "strzały gości",
  homeFouls: "faule gospodarzy",
  awayFouls: "faule gości",
  homeOffsides: "spalone gospodarzy",
  awayOffsides: "spalone gości",
};

const optionalStatsByProvider: Record<string, readonly StatField[]> = {
  "football-data-co-uk": ["homeOffsides", "awayOffsides"],
};

const highLimits: Partial<Record<StatField, number>> = {
  homeCorners: 25,
  awayCorners: 25,
  homeYellowCards: 15,
  awayYellowCards: 15,
  homeRedCards: 5,
  awayRedCards: 5,
  homeShotsOnTarget: 30,
  awayShotsOnTarget: 30,
  homeShots: 60,
  awayShots: 60,
  homeFouls: 45,
  awayFouls: 45,
  homeOffsides: 15,
  awayOffsides: 15,
};

function optionalFields(match: QualityMatch) {
  const providerCode = match.dataSource?.providerCode ?? "";
  return new Set<StatField>(optionalStatsByProvider[providerCode] ?? []);
}

export function missingRequiredStatFields(match: QualityMatch) {
  if (!match.stats) return [...statFields];
  const optional = optionalFields(match);
  return statFields.filter(
    (field) => !optional.has(field) && match.stats?.[field] === null,
  );
}

export function hasCompleteRequiredStats(match: QualityMatch) {
  return Boolean(match.stats) && missingRequiredStatFields(match).length === 0;
}

export function countSourceLimitedMatches(matches: QualityMatch[]) {
  return matches.filter((match) => {
    if (!match.stats || match.status !== "FINISHED") return false;
    const optional = optionalFields(match);
    return [...optional].some((field) => match.stats?.[field] === null);
  }).length;
}

export function findDataQualityIssues(matches: QualityMatch[]) {
  const issues: QualityIssue[] = [];
  const seen = new Map<string, string>();

  for (const match of matches) {
    const label = `${match.homeTeam.name} – ${match.awayTeam.name}`;
    const leagueSeason = `${match.season.league.name} · ${match.season.name}`;
    const add = (
      type: string,
      message: string,
      severity: "error" | "warning" = "warning",
    ) => issues.push({
      key: `${match.id}-${type}-${issues.length}`,
      severity,
      type,
      message,
      matchId: match.id,
      matchLabel: label,
      leagueSeason,
    });

    const duplicateKey = `${match.seasonId}:${match.homeTeamId}:${match.awayTeamId}:${match.kickoffAt.toISOString()}`;
    if (seen.has(duplicateKey)) {
      add("DUPLIKAT", "Mecz ma identyczny sezon, drużyny i termin jak inny rekord.", "error");
    } else {
      seen.set(duplicateKey, match.id);
    }

    if (!match.refereeId && match.status === "FINISHED") {
      add("BRAK_SĘDZIEGO", "Zakończony mecz nie ma przypisanego sędziego.");
    }
    if (match.status === "FINISHED" && (match.homeScore === null || match.awayScore === null)) {
      add("BRAK_WYNIKU", "Mecz jest zakończony, ale nie ma pełnego wyniku.", "error");
    }
    if (match.status === "FINISHED" && !match.stats) {
      add("BRAK_STATYSTYK", "Zakończony mecz nie ma rekordu statystyk.", "error");
    }

    if (match.stats) {
      const missing = missingRequiredStatFields(match);
      if (match.status === "FINISHED" && missing.length) {
        add(
          "BRAKUJĄCE_STATYSTYKI",
          `Brakuje: ${missing.map((field) => statLabels[field]).join(", ")}.`,
        );
      }

      for (const field of statFields) {
        const value = match.stats[field];
        if (typeof value === "number" && value < 0) {
          add("WARTOŚĆ_UJEMNA", `${statLabels[field]}: ${value}`, "error");
        }
        const limit = highLimits[field];
        if (typeof value === "number" && limit !== undefined && value > limit) {
          add(
            "WARTOŚĆ_PODEJRZANA",
            `${statLabels[field]}: ${value} przekracza próg ${limit}.`,
          );
        }
      }

      if (
        match.stats.homeShotsOnTarget !== null
        && match.stats.homeShots !== null
        && match.stats.homeShotsOnTarget > match.stats.homeShots
      ) {
        add(
          "CELNE_GT_STRZAŁY",
          "Celne strzały gospodarza przekraczają wszystkie strzały.",
          "error",
        );
      }
      if (
        match.stats.awayShotsOnTarget !== null
        && match.stats.awayShots !== null
        && match.stats.awayShotsOnTarget > match.stats.awayShots
      ) {
        add(
          "CELNE_GT_STRZAŁY",
          "Celne strzały gościa przekraczają wszystkie strzały.",
          "error",
        );
      }
    }
  }

  return issues;
}
