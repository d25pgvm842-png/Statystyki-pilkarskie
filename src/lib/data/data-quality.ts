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
  leagueId: string;
  seasonId: string;
  dataSourceId: string | null;
  providerCode: string | null;
  sourceName: string;
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

export const QUALITY_STAT_GROUPS = [
  { key: "corners", label: "Rożne", fields: ["homeCorners", "awayCorners"] },
  { key: "yellowCards", label: "Żółte", fields: ["homeYellowCards", "awayYellowCards"] },
  { key: "redCards", label: "Czerwone", fields: ["homeRedCards", "awayRedCards"] },
  { key: "shotsOnTarget", label: "Celne", fields: ["homeShotsOnTarget", "awayShotsOnTarget"] },
  { key: "shots", label: "Strzały", fields: ["homeShots", "awayShots"] },
  { key: "fouls", label: "Faule", fields: ["homeFouls", "awayFouls"] },
  { key: "offsides", label: "Spalone", fields: ["homeOffsides", "awayOffsides"] },
] as const satisfies ReadonlyArray<{
  key: string;
  label: string;
  fields: readonly StatField[];
}>;

const providerOptionalStats: Record<string, readonly StatField[]> = {
  "football-data-co-uk": ["homeOffsides", "awayOffsides"],
  "football-data-org": statFields,
  openfootball: statFields,
};

const providerWithoutReliableReferees = new Set([
  "openfootball",
]);

const MIN_CAPABILITY_SAMPLE = 10;
const SUPPORTED_COVERAGE_THRESHOLD = 0.5;

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

export type CoverageCell = {
  available: number;
  total: number;
  rate: number;
  supported: boolean;
};

export type SourceCapabilityProfile = {
  key: string;
  leagueId: string;
  leagueName: string;
  seasonId: string;
  seasonName: string;
  dataSourceId: string | null;
  providerCode: string | null;
  sourceName: string;
  finishedMatches: number;
  referee: CoverageCell;
  stats: Record<StatField, CoverageCell>;
  limitations: string[];
};

export type DataQualityContext = {
  profiles: SourceCapabilityProfile[];
  byGroup: Map<string, SourceCapabilityProfile>;
};

function sourceName(match: QualityMatch) {
  return match.dataSource?.name ?? "Źródło nieokreślone";
}

function groupKey(match: QualityMatch) {
  const sourceKey = match.dataSourceId
    ?? match.dataSource?.providerCode
    ?? "unknown";
  return `${match.seasonId}:${sourceKey}`;
}

function percentage(available: number, total: number) {
  return total > 0 ? (available / total) * 100 : 0;
}

function defaultStatSupported(match: QualityMatch, field: StatField) {
  if (!match.dataSource) return true;
  const providerCode = match.dataSource.providerCode ?? "";
  return !(providerOptionalStats[providerCode] ?? []).includes(field);
}

function defaultRefereeSupported(match: QualityMatch) {
  if (!match.dataSource) return true;
  return !providerWithoutReliableReferees.has(match.dataSource.providerCode ?? "");
}

function inferredSupport(total: number, available: number, fallback: boolean) {
  if (total < MIN_CAPABILITY_SAMPLE) return fallback;
  return available / total >= SUPPORTED_COVERAGE_THRESHOLD;
}

function coverageCell(total: number, available: number, fallback: boolean): CoverageCell {
  return {
    available,
    total,
    rate: percentage(available, total),
    supported: inferredSupport(total, available, fallback),
  };
}

export function buildDataQualityContext(matches: QualityMatch[]): DataQualityContext {
  const groups = new Map<string, QualityMatch[]>();

  for (const match of matches) {
    if (match.status !== "FINISHED") continue;
    const key = groupKey(match);
    const current = groups.get(key) ?? [];
    current.push(match);
    groups.set(key, current);
  }

  const profiles = [...groups.entries()].map(([key, group]) => {
    const sample = group[0]!;
    const total = group.length;
    const refereeAvailable = group.filter((match) => Boolean(match.refereeId)).length;
    const referee = coverageCell(total, refereeAvailable, defaultRefereeSupported(sample));

    const stats = Object.fromEntries(statFields.map((field) => {
      const available = group.filter((match) => typeof match.stats?.[field] === "number").length;
      return [field, coverageCell(total, available, defaultStatSupported(sample, field))];
    })) as Record<StatField, CoverageCell>;

    const limitations: string[] = [];
    if (!referee.supported && referee.available < referee.total) limitations.push("sędzia");
    for (const definition of QUALITY_STAT_GROUPS) {
      const fields = definition.fields.map((field) => stats[field]);
      if (fields.every((field) => !field.supported) && fields.some((field) => field.available < field.total)) {
        limitations.push(definition.label.toLowerCase());
      }
    }

    return {
      key,
      leagueId: sample.season.league.id,
      leagueName: sample.season.league.name,
      seasonId: sample.season.id,
      seasonName: sample.season.name,
      dataSourceId: sample.dataSourceId ?? null,
      providerCode: sample.dataSource?.providerCode ?? null,
      sourceName: sourceName(sample),
      finishedMatches: total,
      referee,
      stats,
      limitations,
    } satisfies SourceCapabilityProfile;
  }).sort((a, b) => (
    a.leagueName.localeCompare(b.leagueName, "pl")
    || b.seasonName.localeCompare(a.seasonName, "pl")
    || a.sourceName.localeCompare(b.sourceName, "pl")
  ));

  return {
    profiles,
    byGroup: new Map(profiles.map((profile) => [profile.key, profile])),
  };
}

function contextFor(matches: QualityMatch[], context?: DataQualityContext) {
  return context ?? buildDataQualityContext(matches);
}

function profileFor(match: QualityMatch, context: DataQualityContext) {
  return context.byGroup.get(groupKey(match));
}

export function isRefereeExpected(match: QualityMatch, context?: DataQualityContext) {
  const resolved = contextFor([match], context);
  return profileFor(match, resolved)?.referee.supported ?? defaultRefereeSupported(match);
}

export function isStatExpected(
  match: QualityMatch,
  field: StatField,
  context?: DataQualityContext,
) {
  const resolved = contextFor([match], context);
  return profileFor(match, resolved)?.stats[field].supported ?? defaultStatSupported(match, field);
}

export function missingRequiredStatFields(
  match: QualityMatch,
  context?: DataQualityContext,
) {
  if (!match.stats) return [...statFields];
  const resolved = contextFor([match], context);
  return statFields.filter(
    (field) => isStatExpected(match, field, resolved) && match.stats?.[field] === null,
  );
}

export function hasCompleteRequiredStats(
  match: QualityMatch,
  context?: DataQualityContext,
) {
  return Boolean(match.stats) && missingRequiredStatFields(match, context).length === 0;
}

export function countSourceLimitedMatches(
  matches: QualityMatch[],
  context?: DataQualityContext,
) {
  const resolved = contextFor(matches, context);
  return matches.filter((match) => {
    if (match.status !== "FINISHED") return false;
    if (!match.refereeId && !isRefereeExpected(match, resolved)) return true;
    if (!match.stats) return false;
    return statFields.some(
      (field) => match.stats?.[field] === null && !isStatExpected(match, field, resolved),
    );
  }).length;
}

export function countMissingExpectedReferees(
  matches: QualityMatch[],
  context?: DataQualityContext,
) {
  const resolved = contextFor(matches, context);
  return matches.filter(
    (match) => match.status === "FINISHED"
      && !match.refereeId
      && isRefereeExpected(match, resolved),
  ).length;
}

export function findDataQualityIssues(
  matches: QualityMatch[],
  context?: DataQualityContext,
) {
  const resolved = contextFor(matches, context);
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
      leagueId: match.season.league.id,
      seasonId: match.season.id,
      dataSourceId: match.dataSourceId ?? null,
      providerCode: match.dataSource?.providerCode ?? null,
      sourceName: sourceName(match),
    });

    const duplicateKey = `${match.seasonId}:${match.homeTeamId}:${match.awayTeamId}:${match.kickoffAt.toISOString()}`;
    if (seen.has(duplicateKey)) {
      add("DUPLIKAT", "Mecz ma identyczny sezon, drużyny i termin jak inny rekord.", "error");
    } else {
      seen.set(duplicateKey, match.id);
    }

    if (
      !match.refereeId
      && match.status === "FINISHED"
      && isRefereeExpected(match, resolved)
    ) {
      add("BRAK_SĘDZIEGO", "Zakończony mecz nie ma przypisanego sędziego.");
    }
    if (match.status === "FINISHED" && (match.homeScore === null || match.awayScore === null)) {
      add("BRAK_WYNIKU", "Mecz jest zakończony, ale nie ma pełnego wyniku.", "error");
    }
    if (match.status === "FINISHED" && !match.stats) {
      add("BRAK_STATYSTYK", "Zakończony mecz nie ma rekordu statystyk.", "error");
    }

    if (match.stats) {
      const missing = missingRequiredStatFields(match, resolved);
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
