import { Prisma } from "@/generated/prisma/client";
import {
  ImportRowStatus,
  ImportStatus,
  type MatchStatus,
} from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { listExternalMappings } from "@/lib/external-mappings";
import { normalizeLookup } from "@/lib/imports/csv";
import { buildExternalPreviewActions } from "@/lib/imports/external-preview-policy";

export type ExternalStats = {
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
};

export type ExternalTeamInput = {
  externalId: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
};

export type ExternalMatchInput = {
  externalId: string;
  kickoffAt: Date;
  kickoffTimeKnown: boolean;
  round: number | null;
  home: ExternalTeamInput;
  away: ExternalTeamInput;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  refereeName: string | null;
  stats: ExternalStats;
  note: string;
};

export type ExternalTeamCandidate = {
  externalId: string;
  name: string;
  shortName: string | null;
  country: string;
  existingId: string | null;
  requiresMembership: boolean;
  requiresMapping: boolean;
};

export type ExternalRefereeCandidate = {
  name: string;
  existingId: string | null;
  requiresMembership: boolean;
};

export type ExternalPreparedRowData = {
  provider?: string;
  providerName?: string;
  externalLeagueId?: string;
  operation?: "CREATE" | "UPDATE";
  existingMatchId?: string | null;
  preparedMatchUpdatedAt?: string | null;
  sourceExternalId?: string | null;
  sourceUpdatedAt?: string | null;
  seasonId: string;
  round: number | null;
  kickoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamCandidate?: ExternalTeamCandidate;
  awayTeamCandidate?: ExternalTeamCandidate;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  refereeId: string | null;
  refereeName: string | null;
  refereeCandidate?: ExternalRefereeCandidate | null;
  note: string | null;
  stats: ExternalStats;
  previewActions?: string[];
  importedMatchId?: string | null;
  duplicateMatchId?: string | null;
  importedAt?: string | null;
};

type SeasonWithLeague = {
  id: string;
  leagueId: string;
  startsAt: Date;
  league: {
    id: string;
    name: string;
    code: string;
    country: string;
  };
};

type TeamRecord = {
  id: string;
  name: string;
  shortName: string | null;
  slug: string;
  country: string;
};

type ExistingMatch = {
  id: string;
  kickoffAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  sourceExternalId: string | null;
  updatedAt: Date;
};

const TEAM_KEY_ALIASES: Record<string, string> = {
  "atletico madrid": "atletico",
  "atletico madryt": "atletico",
  "bayern munchen": "bayern",
  "bayern monachium": "bayern",
  "fc internazionale milano": "inter",
  internazionale: "inter",
  "inter milan": "inter",
  "olympique de marseille": "olympique marsylia",
};

function teamKey(value: string) {
  const normalized = normalizeLookup(value)
    .replace(/\b(football club|futbol club|fc|afc|cf|ac|as|sc|club|calcio)\b/g, " ")
    .replace(/\b04\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return TEAM_KEY_ALIASES[normalized] ?? normalized;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function teamCandidate(input: {
  definition: ExternalTeamInput;
  seasonCountry: string;
  mappedId: string | null;
  matchedTeam: TeamRecord | null;
  membershipIds: Set<string>;
}) {
  const existingId = input.mappedId ?? input.matchedTeam?.id ?? null;
  return {
    externalId: input.definition.externalId,
    name: input.definition.name,
    shortName: input.definition.shortName?.trim() || null,
    country: input.definition.country?.trim() || input.seasonCountry,
    existingId,
    requiresMembership: !existingId || !input.membershipIds.has(existingId),
    requiresMapping: !input.mappedId || input.mappedId !== existingId,
  } satisfies ExternalTeamCandidate;
}

export async function prepareExternalImportBatch(input: {
  userId: string;
  season: SeasonWithLeague;
  providerCode: string;
  providerName: string;
  externalLeagueId: string;
  batchName: string;
  matches: ExternalMatchInput[];
}) {
  const matches = input.matches
    .filter((match) => !Number.isNaN(match.kickoffAt.getTime()))
    .sort((left, right) => left.kickoffAt.getTime() - right.kickoffAt.getTime());

  if (!matches.length) throw new Error("Źródło nie zwróciło żadnych poprawnych meczów.");

  const [source, mappings, allTeams, memberships, allReferees, refereeMemberships] = await Promise.all([
    prisma.dataSource.findUnique({
      where: { providerCode: input.providerCode },
      select: { id: true },
    }),
    listExternalMappings({ providerCode: input.providerCode, active: true }),
    prisma.team.findMany({
      select: { id: true, name: true, shortName: true, slug: true, country: true },
    }),
    prisma.seasonTeam.findMany({
      where: { seasonId: input.season.id },
      select: { teamId: true },
    }),
    prisma.referee.findMany({ select: { id: true, name: true, slug: true } }),
    prisma.refereeSeason.findMany({
      where: { seasonId: input.season.id },
      select: { refereeId: true },
    }),
  ]);

  const teamById = new Map(allTeams.map((team) => [team.id, team]));
  const teamByKey = new Map<string, TeamRecord>();
  for (const team of allTeams) {
    teamByKey.set(teamKey(team.name), team);
    if (team.shortName) teamByKey.set(teamKey(team.shortName), team);
    teamByKey.set(teamKey(team.slug), team);
  }

  const teamMembershipIds = new Set(memberships.map((item) => item.teamId));
  const refereeMembershipIds = new Set(refereeMemberships.map((item) => item.refereeId));
  const refereeByKey = new Map(
    allReferees.flatMap((referee) => [
      [normalizeLookup(referee.name), referee] as const,
      [normalizeLookup(referee.slug), referee] as const,
    ]),
  );

  const teamMappings = mappings.filter((mapping) => mapping.entityType === "TEAM");
  const internalByExternal = new Map(teamMappings.map((mapping) => [mapping.externalId, mapping.internalId]));
  const leagueMappingExists = mappings.some(
    (mapping) => mapping.entityType === "LEAGUE"
      && mapping.internalId === input.season.leagueId
      && mapping.externalId === input.externalLeagueId,
  );

  const candidateByExternal = new Map<string, ExternalTeamCandidate>();
  for (const match of matches) {
    for (const definition of [match.home, match.away]) {
      if (candidateByExternal.has(definition.externalId)) continue;
      const mappedId = internalByExternal.get(definition.externalId) ?? null;
      const mappedTeam = mappedId ? teamById.get(mappedId) ?? null : null;
      const matchedTeam = mappedTeam ?? teamByKey.get(teamKey(definition.name)) ?? null;
      candidateByExternal.set(definition.externalId, teamCandidate({
        definition,
        seasonCountry: input.season.league.country,
        mappedId: mappedTeam?.id ?? null,
        matchedTeam,
        membershipIds: teamMembershipIds,
      }));
    }
  }

  const externalIds = matches.map((match) => match.externalId);
  const existingByExternal = source
    ? new Map<string, ExistingMatch>(
        (await prisma.match.findMany({
          where: {
            dataSourceId: source.id,
            sourceExternalId: { in: externalIds },
          },
          select: {
            id: true,
            sourceExternalId: true,
            kickoffAt: true,
            homeTeamId: true,
            awayTeamId: true,
            updatedAt: true,
          },
        })).map((match) => [match.sourceExternalId!, match]),
      )
    : new Map<string, ExistingMatch>();

  const existingSeasonMatches: ExistingMatch[] = await prisma.match.findMany({
    where: { seasonId: input.season.id },
    select: {
      id: true,
      sourceExternalId: true,
      kickoffAt: true,
      homeTeamId: true,
      awayTeamId: true,
      updatedAt: true,
    },
  });
  const existingByDay = new Map(
    existingSeasonMatches.map((match) => [
      `${match.homeTeamId}:${match.awayTeamId}:${isoDay(match.kickoffAt)}`,
      match,
    ]),
  );

  let valid = 0;
  let invalid = 0;
  const preparedRows: Array<{
    rowNumber: number;
    status: ImportRowStatus;
    data: ExternalPreparedRowData;
    errors: string[];
  }> = [];

  for (const [index, match] of matches.entries()) {
    const errors: string[] = [];
    const home = candidateByExternal.get(match.home.externalId)!;
    const away = candidateByExternal.get(match.away.externalId)!;

    if (home.existingId && away.existingId && home.existingId === away.existingId) {
      errors.push("Gospodarz i gość wskazują tę samą drużynę.");
    }

    const sourceExisting = existingByExternal.get(match.externalId) ?? null;
    const dayExisting = home.existingId && away.existingId
      ? existingByDay.get(`${home.existingId}:${away.existingId}:${isoDay(match.kickoffAt)}`) ?? null
      : null;
    const existing = sourceExisting ?? dayExisting;
    const kickoffAt = sourceExisting?.kickoffAt
      ?? (!match.kickoffTimeKnown && dayExisting ? dayExisting.kickoffAt : match.kickoffAt);

    const refereeName = match.refereeName?.trim() || null;
    const existingReferee = refereeName
      ? refereeByKey.get(normalizeLookup(refereeName)) ?? null
      : null;
    const refereeCandidate = refereeName
      ? {
          name: refereeName,
          existingId: existingReferee?.id ?? null,
          requiresMembership: !existingReferee || !refereeMembershipIds.has(existingReferee.id),
        } satisfies ExternalRefereeCandidate
      : null;

    const operation = existing ? "UPDATE" as const : "CREATE" as const;
    const previewActions = buildExternalPreviewActions({
      operation,
      sourceExists: Boolean(source),
      leagueMappingExists,
      home,
      away,
      referee: refereeCandidate,
    });

    const data: ExternalPreparedRowData = {
      provider: input.providerCode,
      providerName: input.providerName,
      externalLeagueId: input.externalLeagueId,
      operation,
      existingMatchId: existing?.id ?? null,
      preparedMatchUpdatedAt: existing?.updatedAt.toISOString() ?? null,
      sourceExternalId: match.externalId,
      sourceUpdatedAt: new Date().toISOString(),
      seasonId: input.season.id,
      round: match.round,
      kickoffAt: kickoffAt.toISOString(),
      homeTeamId: home.existingId ?? "",
      awayTeamId: away.existingId ?? "",
      homeTeamName: home.name,
      awayTeamName: away.name,
      homeTeamCandidate: home,
      awayTeamCandidate: away,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
      refereeId: refereeCandidate?.existingId ?? null,
      refereeName,
      refereeCandidate,
      note: match.note,
      stats: match.stats,
      previewActions,
      importedMatchId: null,
      duplicateMatchId: null,
      importedAt: null,
    };

    const status = errors.length ? ImportRowStatus.INVALID : ImportRowStatus.VALID;
    if (status === ImportRowStatus.VALID) valid += 1;
    else invalid += 1;
    preparedRows.push({ rowNumber: index + 1, status, data, errors });
  }

  return prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        fileName: input.batchName,
        status: ImportStatus.VALIDATING,
        sourceId: source?.id ?? null,
        createdById: input.userId,
        rowsTotal: preparedRows.length,
      },
    });

    await tx.importRow.createMany({
      data: preparedRows.map((row) => ({
        importId: batch.id,
        rowNumber: row.rowNumber,
        status: row.status,
        rawData: row.data as unknown as Prisma.InputJsonValue,
        errors: row.errors.length
          ? row.errors as unknown as Prisma.InputJsonValue
          : Prisma.DbNull,
      })),
    });

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: valid > 0 ? ImportStatus.READY : ImportStatus.FAILED,
        rowsValid: valid,
        rowsInvalid: invalid,
        rowsDuplicate: 0,
      },
    });

    return batch.id;
  });
}
