"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import {
  DataSourceType,
  ImportRowStatus,
  ImportStatus,
  MatchStatus,
} from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listExternalMappings, replaceExternalMapping } from "@/lib/external-mappings";
import {
  normalizeLookup,
  parseCsv,
  parseNullableInteger,
  type CsvRecord,
} from "@/lib/imports/csv";
import {
  footballDataOrgGet,
  isFootballDataOrgConfigured,
  publicJsonGet,
  publicTextGet,
  PublicDataError,
} from "@/lib/public-data/client";
import {
  FOOTBALL_DATA_ORG_PROVIDER_CODE,
  FOOTBALL_DATA_UK_PROVIDER_CODE,
  OPEN_FOOTBALL_PROVIDER_CODE,
  footballDataOrgCompetitionCode,
  footballDataUkUrl,
  normalizePublicStatus,
  openFootballUrl,
  parseFootballDataKickoff,
  parsePublicRound,
  seasonLabel,
  seasonStartYear,
} from "@/lib/public-data/provider";

const MAX_CURRENT_RANGE_DAYS = 180;

type PublicStats = {
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

type PublicTeam = {
  externalId: string;
  name: string;
  shortName?: string | null;
  country?: string | null;
};

type PublicMatch = {
  externalId: string;
  kickoffAt: Date;
  kickoffTimeKnown: boolean;
  round: number | null;
  home: PublicTeam;
  away: PublicTeam;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  refereeName: string | null;
  stats: PublicStats;
  note: string;
};

type StoredPublicRow = {
  provider: string;
  operation: "CREATE" | "UPDATE";
  existingMatchId: string | null;
  sourceExternalId: string;
  sourceUpdatedAt: string;
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
  stats: PublicStats;
  importedMatchId?: string | null;
  duplicateMatchId?: string | null;
  importedAt?: string | null;
};

type SeasonWithLeague = {
  id: string;
  leagueId: string;
  startsAt: Date;
  endsAt: Date;
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

type RefereeRecord = {
  id: string;
  name: string;
  slug: string;
};

type ExistingMatchRef = {
  id: string;
  kickoffAt: Date;
  homeTeamId: string;
  awayTeamId: string;
  sourceExternalId?: string | null;
};

type LoadedPublicData = {
  providerCode: string;
  providerName: string;
  externalLeagueId: string;
  matches: PublicMatch[];
};

function emptyStats(): PublicStats {
  return {
    homeCorners: null,
    awayCorners: null,
    homeYellowCards: null,
    awayYellowCards: null,
    homeRedCards: null,
    awayRedCards: null,
    homeShotsOnTarget: null,
    awayShotsOnTarget: null,
    homeShots: null,
    awayShots: null,
    homeFouls: null,
    awayFouls: null,
    homeOffsides: null,
    awayOffsides: null,
  };
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function toUtcDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function slugify(value: string, suffix?: string) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const cleanSuffix = suffix
    ?.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return cleanSuffix ? `${base}-${cleanSuffix}` : base;
}

const TEAM_KEY_ALIASES: Record<string, string> = {
  "atletico madrid": "atletico",
  "atletico madryt": "atletico",
  "bayern munchen": "bayern",
  "bayern monachium": "bayern",
  "fc internazionale milano": "inter",
  "internazionale": "inter",
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

function nullableInteger(record: CsvRecord, field: string) {
  const value = parseNullableInteger(record[field]);
  return Number.isNaN(value) ? null : value;
}

function publicErrorHref(
  errorCode: "public-provider" | "public-empty" | "public-range" | "public-season",
  detail?: string,
  seasonId?: string,
) {
  const params = new URLSearchParams({ error: errorCode });
  if (detail) params.set("detail", detail.slice(0, 700));
  if (seasonId) params.set("seasonId", seasonId);
  return `/automation?${params.toString()}`;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Brak uprawnień administratora.");
  return user;
}

function errorDetail(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Nieznany błąd źródła.";
}

async function ensureSeason(leagueId: string, startYear: number) {
  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) return null;

  const name = seasonLabel(startYear);
  const season = await prisma.season.upsert({
    where: { leagueId_name: { leagueId, name } },
    update: {
      startsAt: new Date(Date.UTC(startYear, 6, 1)),
      endsAt: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59)),
    },
    create: {
      leagueId,
      name,
      startsAt: new Date(Date.UTC(startYear, 6, 1)),
      endsAt: new Date(Date.UTC(startYear + 1, 5, 30, 23, 59, 59)),
      active: false,
    },
    include: { league: true },
  });

  return season as SeasonWithLeague;
}

async function upsertSourceAndLeagueMapping(
  season: SeasonWithLeague,
  providerCode: string,
  providerName: string,
  externalLeagueId: string,
) {
  const source = await prisma.dataSource.upsert({
    where: { providerCode },
    update: { name: providerName, type: DataSourceType.API, active: true },
    create: {
      name: providerName,
      providerCode,
      type: DataSourceType.API,
      active: true,
    },
  });

  await replaceExternalMapping({
    providerCode,
    entityType: "LEAGUE",
    internalId: season.leagueId,
    externalId: externalLeagueId,
    externalName: season.league.name,
    metadata: {
      season: seasonLabel(seasonStartYear(season.startsAt)),
    } as Prisma.InputJsonValue,
    active: true,
  });

  return source;
}

async function resolveTeams(
  season: SeasonWithLeague,
  providerCode: string,
  matches: PublicMatch[],
) {
  const definitions = new Map<string, PublicTeam>();
  for (const match of matches) {
    definitions.set(match.home.externalId, match.home);
    definitions.set(match.away.externalId, match.away);
  }

  const allTeams: TeamRecord[] = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      country: true,
    },
  });

  const byKey = new Map<string, TeamRecord>();
  for (const team of allTeams) {
    byKey.set(teamKey(team.name), team);
    if (team.shortName) byKey.set(teamKey(team.shortName), team);
    byKey.set(teamKey(team.slug), team);
  }

  const mappings = await listExternalMappings({
    providerCode,
    entityType: "TEAM",
    active: true,
  });
  const internalByExternal = new Map(
    mappings.map((mapping) => [mapping.externalId, mapping.internalId]),
  );

  const resolved = new Map<string, string>();

  for (const definition of definitions.values()) {
    let internalId = internalByExternal.get(definition.externalId);
    let team = internalId
      ? allTeams.find((candidate) => candidate.id === internalId) ?? null
      : null;

    if (!team) {
      team = byKey.get(teamKey(definition.name)) ?? null;
    }

    if (!team) {
      const baseSlug = slugify(definition.name);
      const bySlug = allTeams.find((candidate) => candidate.slug === baseSlug) ?? null;
      if (bySlug) {
        team = bySlug;
      } else {
        team = await prisma.team.create({
          data: {
            name: definition.name,
            shortName: definition.shortName || null,
            slug: slugify(definition.name, definition.externalId),
            country: definition.country || season.league.country,
            active: true,
          },
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            country: true,
          },
        });
        allTeams.push(team);
      }
    }

    internalId = team.id;
    byKey.set(teamKey(definition.name), team);
    if (definition.shortName) byKey.set(teamKey(definition.shortName), team);

    await prisma.seasonTeam.upsert({
      where: {
        seasonId_teamId: {
          seasonId: season.id,
          teamId: internalId,
        },
      },
      update: {},
      create: {
        seasonId: season.id,
        teamId: internalId,
      },
    });

    await replaceExternalMapping({
      providerCode,
      entityType: "TEAM",
      internalId,
      externalId: definition.externalId,
      externalName: definition.name,
      metadata: {
        shortName: definition.shortName ?? null,
        country: definition.country ?? null,
      } as Prisma.InputJsonValue,
      active: true,
    });

    resolved.set(definition.externalId, internalId);
  }

  return resolved;
}

async function resolveReferees(seasonId: string, matches: PublicMatch[]) {
  const names = [
    ...new Set(
      matches
        .map((match) => match.refereeName?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];

  const existing: RefereeRecord[] = await prisma.referee.findMany({
    select: { id: true, name: true, slug: true },
  });
  const byKey = new Map<string, RefereeRecord>(
    existing.map((referee) => [normalizeLookup(referee.name), referee]),
  );
  const result = new Map<string, string>();

  for (const name of names) {
    const key = normalizeLookup(name);
    let referee = byKey.get(key);

    if (!referee) {
      const slug = slugify(name);
      referee = await prisma.referee.upsert({
        where: { slug },
        update: { name, active: true },
        create: { name, slug, active: true },
        select: { id: true, name: true, slug: true },
      });
      byKey.set(key, referee);
    }

    await prisma.refereeSeason.upsert({
      where: {
        refereeId_seasonId: {
          refereeId: referee.id,
          seasonId,
        },
      },
      update: {},
      create: {
        refereeId: referee.id,
        seasonId,
      },
    });

    result.set(key, referee.id);
  }

  return result;
}

async function preparePublicBatch(input: {
  userId: string;
  season: SeasonWithLeague;
  providerCode: string;
  providerName: string;
  externalLeagueId: string;
  batchName: string;
  matches: PublicMatch[];
}) {
  const { userId, season, providerCode, providerName, externalLeagueId, batchName } = input;
  const matches = input.matches
    .filter((match) => !Number.isNaN(match.kickoffAt.getTime()))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());

  if (!matches.length) {
    throw new PublicDataError("Źródło nie zwróciło żadnych meczów.", providerName);
  }

  const source = await upsertSourceAndLeagueMapping(
    season,
    providerCode,
    providerName,
    externalLeagueId,
  );
  const teamIds = await resolveTeams(season, providerCode, matches);
  const refereeIds = await resolveReferees(season.id, matches);

  const externalIds = matches.map((match) => match.externalId);
  const existingByExternal = new Map<string, ExistingMatchRef>(
    (
      await prisma.match.findMany({
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
        },
      })
    ).map((match) => [match.sourceExternalId!, match]),
  );

  const existingSeasonMatches: ExistingMatchRef[] = await prisma.match.findMany({
    where: { seasonId: season.id },
    select: {
      id: true,
      kickoffAt: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  });
  const existingByDay = new Map<string, ExistingMatchRef>(
    existingSeasonMatches.map((match) => [
      `${match.homeTeamId}:${match.awayTeamId}:${isoDay(match.kickoffAt)}`,
      match,
    ]),
  );

  const batch = await prisma.importBatch.create({
    data: {
      fileName: batchName,
      status: ImportStatus.VALIDATING,
      sourceId: source.id,
      createdById: userId,
      rowsTotal: matches.length,
    },
  });

  let valid = 0;
  let invalid = 0;
  const rows: Prisma.ImportRowCreateManyInput[] = [];

  for (const [index, match] of matches.entries()) {
    const errors: string[] = [];
    const homeTeamId = teamIds.get(match.home.externalId);
    const awayTeamId = teamIds.get(match.away.externalId);

    if (!homeTeamId) errors.push(`Nie udało się połączyć gospodarza „${match.home.name}”.`);
    if (!awayTeamId) errors.push(`Nie udało się połączyć gościa „${match.away.name}”.`);
    if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
      errors.push("Gospodarz i gość wskazują tę samą drużynę.");
    }

    const sourceExisting = existingByExternal.get(match.externalId);
    const dayExisting = homeTeamId && awayTeamId
      ? existingByDay.get(`${homeTeamId}:${awayTeamId}:${isoDay(match.kickoffAt)}`)
      : null;
    const existing = sourceExisting ?? dayExisting ?? null;
    const kickoffAt = sourceExisting?.kickoffAt
      ?? (!match.kickoffTimeKnown && dayExisting
        ? dayExisting.kickoffAt
        : match.kickoffAt);
    const refereeId = match.refereeName
      ? refereeIds.get(normalizeLookup(match.refereeName)) ?? null
      : null;

    const stored: StoredPublicRow = {
      provider: providerCode,
      operation: existing ? "UPDATE" : "CREATE",
      existingMatchId: existing?.id ?? null,
      sourceExternalId: match.externalId,
      sourceUpdatedAt: new Date().toISOString(),
      seasonId: season.id,
      round: match.round,
      kickoffAt: kickoffAt.toISOString(),
      homeTeamId: homeTeamId ?? "",
      awayTeamId: awayTeamId ?? "",
      homeTeamName: match.home.name,
      awayTeamName: match.away.name,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      status: match.status,
      refereeId,
      refereeName: match.refereeName,
      note: match.note,
      stats: match.stats,
      importedMatchId: null,
      duplicateMatchId: null,
      importedAt: null,
    };

    const status = errors.length ? ImportRowStatus.INVALID : ImportRowStatus.VALID;
    if (status === ImportRowStatus.VALID) valid += 1;
    else invalid += 1;

    rows.push({
      importId: batch.id,
      rowNumber: index + 1,
      status,
      rawData: stored as unknown as Prisma.InputJsonValue,
      errors: errors.length
        ? (errors as unknown as Prisma.InputJsonValue)
        : undefined,
    });
  }

  await prisma.$transaction([
    prisma.importRow.createMany({ data: rows }),
    prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        status: valid > 0 ? ImportStatus.READY : ImportStatus.FAILED,
        rowsValid: valid,
        rowsInvalid: invalid,
        rowsDuplicate: 0,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/automation");
  revalidatePath("/imports");
  revalidatePath("/teams");
  revalidatePath("/referees");

  return batch.id;
}

type FootballDataOrgMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: {
    id: number;
    name: string;
    shortName?: string | null;
    tla?: string | null;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName?: string | null;
    tla?: string | null;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  referees?: Array<{
    name: string;
    type?: string | null;
  }>;
};

async function loadFootballDataOrgMatches(
  season: SeasonWithLeague,
  fromValue: string,
  toValue: string,
) {
  const competitionCode = footballDataOrgCompetitionCode(season.league.code);
  if (!competitionCode) {
    throw new PublicDataError(
      "football-data.org nie obsługuje tej ligi w naszej konfiguracji.",
      "football-data.org",
    );
  }

  const response = await footballDataOrgGet<{ matches?: FootballDataOrgMatch[] }>(
    `/competitions/${competitionCode}/matches`,
    {
      season: seasonStartYear(season.startsAt),
      dateFrom: fromValue,
      dateTo: toValue,
    },
  );

  const matches = response.matches ?? [];
  return {
    providerCode: FOOTBALL_DATA_ORG_PROVIDER_CODE,
    providerName: "football-data.org",
    externalLeagueId: competitionCode,
    matches: matches.map((match): PublicMatch => {
      const homeScore = match.score?.fullTime?.home ?? null;
      const awayScore = match.score?.fullTime?.away ?? null;
      const referee = match.referees?.find((item) => item.type === "REFEREE")
        ?? match.referees?.[0]
        ?? null;

      return {
        externalId: String(match.id),
        kickoffAt: new Date(match.utcDate),
        kickoffTimeKnown: true,
        round: match.matchday ?? null,
        home: {
          externalId: String(match.homeTeam.id),
          name: match.homeTeam.name,
          shortName: match.homeTeam.shortName || match.homeTeam.tla || null,
          country: season.league.country,
        },
        away: {
          externalId: String(match.awayTeam.id),
          name: match.awayTeam.name,
          shortName: match.awayTeam.shortName || match.awayTeam.tla || null,
          country: season.league.country,
        },
        homeScore,
        awayScore,
        status: normalizePublicStatus(
          match.status,
          homeScore !== null && awayScore !== null,
        ),
        refereeName: referee?.name ?? null,
        stats: emptyStats(),
        note: "Terminarz i wyniki: football-data.org",
      };
    }),
  };
}

type OpenFootballMatch = {
  round?: string | number | null;
  date: string;
  time?: string | null;
  team1: string;
  team2: string;
  score?: {
    ft?: [number, number] | null;
  } | null;
};

async function loadOpenFootballMatches(
  season: SeasonWithLeague,
  from: Date,
  to: Date,
) {
  const startYear = seasonStartYear(season.startsAt);
  const url = openFootballUrl(season.league.code, startYear);
  if (!url) {
    throw new PublicDataError(
      "OpenFootball nie ma skonfigurowanego pliku dla tej ligi.",
      "OpenFootball",
    );
  }

  const response = await publicJsonGet<{ matches?: OpenFootballMatch[] }>(
    url,
    "OpenFootball",
  );

  const matches = (response.matches ?? []).flatMap((match): PublicMatch[] => {
    const time = match.time?.match(/^\d{1,2}:\d{2}$/) ? match.time : "12:00";
    const kickoffAt = new Date(`${match.date}T${time}:00.000Z`);
    if (Number.isNaN(kickoffAt.getTime()) || kickoffAt < from || kickoffAt > to) {
      return [];
    }

    const score = match.score?.ft ?? null;
    const homeScore = score?.[0] ?? null;
    const awayScore = score?.[1] ?? null;
    const homeKey = teamKey(match.team1);
    const awayKey = teamKey(match.team2);

    return [{
      externalId: `${seasonLabel(startYear)}:${match.date}:${homeKey}:${awayKey}`,
      kickoffAt,
      kickoffTimeKnown: Boolean(match.time),
      round: parsePublicRound(match.round),
      home: {
        externalId: homeKey,
        name: match.team1,
        country: season.league.country,
      },
      away: {
        externalId: awayKey,
        name: match.team2,
        country: season.league.country,
      },
      homeScore,
      awayScore,
      status: normalizePublicStatus(
        homeScore !== null && awayScore !== null ? "FINISHED" : "SCHEDULED",
        homeScore !== null && awayScore !== null,
      ),
      refereeName: null,
      stats: emptyStats(),
      note: match.time
        ? "Terminarz i wyniki: OpenFootball"
        : "Terminarz i wyniki: OpenFootball. Godzina nieznana w źródle.",
    }];
  });

  return {
    providerCode: OPEN_FOOTBALL_PROVIDER_CODE,
    providerName: "OpenFootball",
    externalLeagueId: season.league.code,
    matches,
  };
}

function parseFootballDataUkRecord(
  record: CsvRecord,
  season: SeasonWithLeague,
  sourceCode: string,
): PublicMatch | null {
  const kickoffAt = parseFootballDataKickoff(
    record.date || record.kickoff_at,
    record.time,
  );
  const homeName = record.home_team?.trim();
  const awayName = record.away_team?.trim();
  if (!kickoffAt || !homeName || !awayName) return null;
  if (kickoffAt < season.startsAt || kickoffAt > season.endsAt) return null;

  const homeScore = nullableInteger(record, "home_score");
  const awayScore = nullableInteger(record, "away_score");
  const homeKey = teamKey(homeName);
  const awayKey = teamKey(awayName);

  return {
    externalId: `${sourceCode}:${isoDay(kickoffAt)}:${homeKey}:${awayKey}`,
    kickoffAt,
    kickoffTimeKnown: Boolean(record.time?.trim()),
    round: null,
    home: {
      externalId: homeKey,
      name: homeName,
      country: season.league.country,
    },
    away: {
      externalId: awayKey,
      name: awayName,
      country: season.league.country,
    },
    homeScore,
    awayScore,
    status: normalizePublicStatus(
      homeScore !== null && awayScore !== null ? "FINISHED" : "SCHEDULED",
      homeScore !== null && awayScore !== null,
    ),
    refereeName: record.referee?.trim() || null,
    stats: {
      homeCorners: nullableInteger(record, "home_corners"),
      awayCorners: nullableInteger(record, "away_corners"),
      homeYellowCards: nullableInteger(record, "home_yellow_cards"),
      awayYellowCards: nullableInteger(record, "away_yellow_cards"),
      homeRedCards: nullableInteger(record, "home_red_cards"),
      awayRedCards: nullableInteger(record, "away_red_cards"),
      homeShotsOnTarget: nullableInteger(record, "home_shots_on_target"),
      awayShotsOnTarget: nullableInteger(record, "away_shots_on_target"),
      homeShots: nullableInteger(record, "home_shots"),
      awayShots: nullableInteger(record, "away_shots"),
      homeFouls: nullableInteger(record, "home_fouls"),
      awayFouls: nullableInteger(record, "away_fouls"),
      homeOffsides: nullableInteger(record, "home_offsides"),
      awayOffsides: nullableInteger(record, "away_offsides"),
    },
    note: "Wyniki i statystyki: Football-Data.co.uk",
  } satisfies PublicMatch;
}

async function loadFootballDataUkMatches(season: SeasonWithLeague) {
  const startYear = seasonStartYear(season.startsAt);
  const url = footballDataUkUrl(season.league.code, startYear);
  if (!url) {
    throw new PublicDataError(
      "Football-Data.co.uk nie ma skonfigurowanego pliku dla tej ligi.",
      "Football-Data.co.uk",
    );
  }

  const content = await publicTextGet(url, "Football-Data.co.uk");
  if (/^\s*</.test(content)) {
    throw new PublicDataError(
      "Football-Data.co.uk zwróciło stronę HTML zamiast pliku CSV.",
      "Football-Data.co.uk",
    );
  }

  const parsed = parseCsv(content);
  const sourceCode = `${season.league.code}:${seasonLabel(startYear)}`;
  const matches = parsed.records.flatMap((record): PublicMatch[] => {
    const match = parseFootballDataUkRecord(record, season, sourceCode);
    return match ? [match] : [];
  });

  return {
    providerCode: FOOTBALL_DATA_UK_PROVIDER_CODE,
    providerName: "Football-Data.co.uk",
    externalLeagueId: season.league.code,
    matches,
  };
}

export async function prepareCurrentPublicImportAction(formData: FormData) {
  const user = await requireAdmin();
  const seasonId = text(formData, "seasonId");
  const fromValue = text(formData, "from");
  const toValue = text(formData, "to");
  const from = toUtcDate(fromValue);
  const to = toUtcDate(toValue);

  if (
    !from
    || !to
    || to < from
    || daysBetween(from, to) > MAX_CURRENT_RANGE_DAYS
  ) {
    redirect(publicErrorHref("public-range", undefined, seasonId));
  }

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { league: true },
  });
  if (!season) redirect(publicErrorHref("public-season"));

  const typedSeason = season as SeasonWithLeague;
  const attempts: string[] = [];
  let loaded: LoadedPublicData | null = null;

  if (
    footballDataOrgCompetitionCode(typedSeason.league.code)
    && isFootballDataOrgConfigured()
  ) {
    try {
      const result = await loadFootballDataOrgMatches(
        typedSeason,
        fromValue,
        toValue,
      );
      if (result.matches.length) loaded = result;
      else attempts.push("football-data.org: brak meczów w tym zakresie.");
    } catch (error) {
      attempts.push(`football-data.org: ${errorDetail(error)}`);
    }
  }

  if (!loaded && openFootballUrl(
    typedSeason.league.code,
    seasonStartYear(typedSeason.startsAt),
  )) {
    try {
      const result = await loadOpenFootballMatches(typedSeason, from, to);
      if (result.matches.length) loaded = result;
      else attempts.push("OpenFootball: brak meczów w tym zakresie.");
    } catch (error) {
      attempts.push(`OpenFootball: ${errorDetail(error)}`);
    }
  }

  if (!loaded) {
    try {
      const result = await loadFootballDataUkMatches(typedSeason);
      const filtered = result.matches.filter(
        (match) => match.kickoffAt >= from && match.kickoffAt <= to,
      );
      if (filtered.length) loaded = { ...result, matches: filtered };
      else attempts.push("Football-Data.co.uk: brak rozegranych meczów w tym zakresie.");
    } catch (error) {
      attempts.push(`Football-Data.co.uk: ${errorDetail(error)}`);
    }
  }

  if (!loaded) {
    redirect(
      publicErrorHref(
        "public-empty",
        attempts.join(" | ") || "Żadne darmowe źródło nie zwróciło danych.",
        seasonId,
      ),
    );
  }

  try {
    const batchId = await preparePublicBatch({
      userId: user.id,
      season: typedSeason,
      providerCode: loaded.providerCode,
      providerName: loaded.providerName,
      externalLeagueId: loaded.externalLeagueId,
      batchName: `${loaded.providerName} · ${typedSeason.league.name} · ${fromValue}–${toValue}`,
      matches: loaded.matches,
    });
    redirect(`/imports/${batchId}`);
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "digest" in error
      && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      publicErrorHref(
        "public-provider",
        errorDetail(error),
        seasonId,
      ),
    );
  }
}

export async function prepareHistoricalPublicImportAction(formData: FormData) {
  const user = await requireAdmin();
  const leagueId = text(formData, "leagueId");
  const startYear = Number(text(formData, "startYear"));

  if (!leagueId || !Number.isInteger(startYear) || startYear < 1993 || startYear > 2100) {
    redirect(publicErrorHref("public-season"));
  }

  const season = await ensureSeason(leagueId, startYear);
  if (!season) redirect(publicErrorHref("public-season"));

  try {
    const loaded = await loadFootballDataUkMatches(season);
    if (!loaded.matches.length) {
      redirect(
        publicErrorHref(
          "public-empty",
          `Football-Data.co.uk nie zwróciło danych dla ${season.league.name} ${seasonLabel(startYear)}.`,
          season.id,
        ),
      );
    }

    const batchId = await preparePublicBatch({
      userId: user.id,
      season,
      providerCode: loaded.providerCode,
      providerName: loaded.providerName,
      externalLeagueId: loaded.externalLeagueId,
      batchName: `${loaded.providerName} · ${season.league.name} · ${seasonLabel(startYear)}`,
      matches: loaded.matches,
    });
    redirect(`/imports/${batchId}`);
  } catch (error) {
    if (
      error
      && typeof error === "object"
      && "digest" in error
      && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    redirect(
      publicErrorHref(
        "public-provider",
        errorDetail(error),
        season.id,
      ),
    );
  }
}
