"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import {
  DataSourceType,
  ImportRowStatus,
  ImportStatus,
} from "@/generated/prisma/enums";
import { apiFootballGet, ApiFootballError } from "@/lib/api-football/client";
import {
  API_FOOTBALL_LEAGUE_IDS,
  API_FOOTBALL_PROVIDER_CODE,
  apiSeasonYear,
  normalizeFixtureStats,
  normalizeFixtureStatus,
  parseRound,
  type ApiFootballFixture,
  type ApiFootballTeam,
} from "@/lib/api-football/provider";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeLookup } from "@/lib/imports/csv";
import { findExternalMapping, listExternalMappings, replaceExternalMapping } from "@/lib/external-mappings";

const MAX_FIXTURES_PER_BATCH = 20;
const MAX_DATE_RANGE_DAYS = 31;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Brak uprawnień administratora.");
  return user;
}

function slugify(value: string, suffix?: string) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return suffix ? `${base}-${suffix}` : base;
}

function toDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

function providerLeagueId(code: string, override: string) {
  const parsed = Number(override);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return API_FOOTBALL_LEAGUE_IDS[code] ?? null;
}

function apiErrorCode(error: unknown) {
  if (error instanceof ApiFootballError) {
    if (error.status === 429) return "rate";
    if (/API_FOOTBALL_KEY/.test(error.message)) return "key";
    if (error.message === "NO_TEAMS") return "no-teams";
    if (error.message === "NO_FIXTURES") return "no-fixtures";
    return "provider";
  }
  return "unknown";
}

async function sourceAndLeagueMapping(season: {
  leagueId: string;
  league: { id: string; name: string; code: string };
}, externalLeagueId: number) {
  const source = await prisma.dataSource.upsert({
    where: { providerCode: API_FOOTBALL_PROVIDER_CODE },
    update: { name: "API-Football", type: DataSourceType.API, active: true },
    create: {
      name: "API-Football",
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      type: DataSourceType.API,
      active: true,
    },
  });

  await replaceExternalMapping({
    providerCode: API_FOOTBALL_PROVIDER_CODE,
    entityType: "LEAGUE",
    internalId: season.leagueId,
    externalId: String(externalLeagueId),
    externalName: season.league.name,
    active: true,
  });

  return source;
}

export async function syncApiFootballTeamsAction(formData: FormData) {
  await requireAdmin();
  const seasonId = text(formData, "seasonId");
  const externalLeagueOverride = text(formData, "externalLeagueId");

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { league: true },
  });
  if (!season) redirect("/automation?error=season");

  const leagueId = providerLeagueId(season.league.code, externalLeagueOverride);
  if (!leagueId) redirect(`/automation?seasonId=${season.id}&error=league-map`);

  let successHref = "";
  try {
    const teams = await apiFootballGet<ApiFootballTeam[]>("/teams", {
      league: leagueId,
      season: apiSeasonYear(season.startsAt),
    });
    if (!teams.length) throw new ApiFootballError("NO_TEAMS");

    await sourceAndLeagueMapping(season, leagueId);
    const allTeams = await prisma.team.findMany({
      select: { id: true, name: true, shortName: true, slug: true },
    });
    const lookup = new Map<string, (typeof allTeams)[number]>();
    for (const team of allTeams) {
      lookup.set(normalizeLookup(team.name), team);
      if (team.shortName) lookup.set(normalizeLookup(team.shortName), team);
    }

    let created = 0;
    let linked = 0;

    for (const item of teams) {
      const externalId = String(item.team.id);
      const existingMapping = await findExternalMapping({
        providerCode: API_FOOTBALL_PROVIDER_CODE,
        entityType: "TEAM",
        externalId,
      });

      let internalId = existingMapping?.internalId;
      if (!internalId) {
        const matched = lookup.get(normalizeLookup(item.team.name));
        if (matched) {
          internalId = matched.id;
          linked += 1;
        } else {
          const team = await prisma.team.create({
            data: {
              name: item.team.name,
              shortName: item.team.code || null,
              slug: slugify(item.team.name, externalId),
              country: item.team.country || season.league.country,
              active: true,
            },
          });
          internalId = team.id;
          created += 1;
          lookup.set(normalizeLookup(team.name), team);
        }
      }

      await prisma.$transaction(async (tx) => {
        await tx.seasonTeam.upsert({
          where: { seasonId_teamId: { seasonId: season.id, teamId: internalId } },
          update: {},
          create: { seasonId: season.id, teamId: internalId },
        });
        await replaceExternalMapping({
          providerCode: API_FOOTBALL_PROVIDER_CODE,
          entityType: "TEAM",
          internalId,
          externalId,
          externalName: item.team.name,
          metadata: {
            code: item.team.code ?? null,
            country: item.team.country ?? null,
          } as Prisma.InputJsonValue,
          active: true,
        }, tx);
      });
    }

    revalidatePath("/automation");
    revalidatePath("/settings");
    revalidatePath("/teams");
    successHref = `/automation?seasonId=${season.id}&ok=teams&created=${created}&linked=${linked}&total=${teams.length}`;
  } catch (error) {
    redirect(`/automation?seasonId=${season.id}&error=${apiErrorCode(error)}`);
  }
  redirect(successHref);
}

type StoredApiRow = {
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
  status: ReturnType<typeof normalizeFixtureStatus>;
  refereeId: string | null;
  refereeName: string | null;
  note: string | null;
  stats: ReturnType<typeof normalizeFixtureStats>;
  importedMatchId?: string | null;
  duplicateMatchId?: string | null;
  importedAt?: string | null;
};

async function resolveReferee(seasonId: string, name: string | null | undefined) {
  const cleanName = name?.trim();
  if (!cleanName) return null;
  const slug = slugify(cleanName);
  const referee = await prisma.referee.upsert({
    where: { slug },
    update: { name: cleanName, active: true },
    create: { name: cleanName, slug, active: true },
  });
  await prisma.refereeSeason.upsert({
    where: { refereeId_seasonId: { refereeId: referee.id, seasonId } },
    update: {},
    create: { refereeId: referee.id, seasonId },
  });
  return referee;
}

export async function prepareApiFootballImportAction(formData: FormData) {
  const user = await requireAdmin();
  const seasonId = text(formData, "seasonId");
  const externalLeagueOverride = text(formData, "externalLeagueId");
  const fromValue = text(formData, "from");
  const toValue = text(formData, "to");
  const includeStats = formData.get("includeStats") === "on";
  const requestedLimit = Number(text(formData, "limit") || MAX_FIXTURES_PER_BATCH);
  const limit = Math.min(MAX_FIXTURES_PER_BATCH, Math.max(1, Math.trunc(requestedLimit)));

  const from = toDate(fromValue);
  const to = toDate(toValue);
  if (!from || !to || to < from || daysBetween(from, to) > MAX_DATE_RANGE_DAYS) {
    redirect(`/automation?seasonId=${seasonId}&error=date-range`);
  }

  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { league: true },
  });
  if (!season) redirect("/automation?error=season");

  const leagueId = providerLeagueId(season.league.code, externalLeagueOverride);
  if (!leagueId) redirect(`/automation?seasonId=${season.id}&error=league-map`);

  let successBatchId = "";
  try {
    const source = await sourceAndLeagueMapping(season, leagueId);
    const fixtureList = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: leagueId,
      season: apiSeasonYear(season.startsAt),
      from: fromValue,
      to: toValue,
      timezone: "UTC",
    });

    const selected = fixtureList
      .sort((a, b) => a.fixture.date.localeCompare(b.fixture.date))
      .slice(0, limit);
    if (!selected.length) throw new ApiFootballError("NO_FIXTURES");

    let detailed = selected;
    if (includeStats) {
      const ids = selected.map((fixture) => fixture.fixture.id).join("-");
      const response = await apiFootballGet<ApiFootballFixture[]>("/fixtures", { ids });
      const byId = new Map(response.map((fixture) => [fixture.fixture.id, fixture]));
      detailed = selected.map((fixture) => byId.get(fixture.fixture.id) ?? fixture);
    }

    const mappings = await listExternalMappings({
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      entityType: "TEAM",
      active: true,
    });
    const internalByExternal = new Map(mappings.map((mapping) => [mapping.externalId, mapping.internalId]));
    const teamIds = [...new Set(mappings.map((mapping) => mapping.internalId))];
    const teams = await prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: { id: true, name: true },
    });
    const teamNameById = new Map(teams.map((team) => [team.id, team.name]));

    const externalIds = detailed.map((fixture) => String(fixture.fixture.id));
    const existingByExternal = new Map(
      (await prisma.match.findMany({
        where: {
          dataSourceId: source.id,
          sourceExternalId: { in: externalIds },
        },
        select: { id: true, sourceExternalId: true },
      })).map((match) => [match.sourceExternalId!, match.id]),
    );

    const batch = await prisma.importBatch.create({
      data: {
        fileName: `API-Football · ${season.league.name} · ${fromValue}–${toValue}`,
        status: ImportStatus.VALIDATING,
        sourceId: source.id,
        createdById: user.id,
        rowsTotal: detailed.length,
      },
    });

    let valid = 0;
    let invalid = 0;
    let duplicate = 0;
    const rows: Prisma.ImportRowCreateManyInput[] = [];

    for (const [index, fixture] of detailed.entries()) {
      const errors: string[] = [];
      const homeTeamId = internalByExternal.get(String(fixture.teams.home.id));
      const awayTeamId = internalByExternal.get(String(fixture.teams.away.id));
      if (!homeTeamId) errors.push(`Brak mapowania gospodarza „${fixture.teams.home.name}”. Najpierw zsynchronizuj drużyny.`);
      if (!awayTeamId) errors.push(`Brak mapowania gościa „${fixture.teams.away.name}”. Najpierw zsynchronizuj drużyny.`);

      const kickoffAt = new Date(fixture.fixture.date);
      if (Number.isNaN(kickoffAt.getTime())) errors.push("Dostawca zwrócił nieprawidłową datę meczu.");

      const referee = await resolveReferee(season.id, fixture.fixture.referee);
      const sourceExternalId = String(fixture.fixture.id);
      const existingMatchId = existingByExternal.get(sourceExternalId) ?? null;
      const stats = normalizeFixtureStats(fixture);

      const data: StoredApiRow = {
        provider: API_FOOTBALL_PROVIDER_CODE,
        operation: existingMatchId ? "UPDATE" : "CREATE",
        existingMatchId,
        sourceExternalId,
        sourceUpdatedAt: new Date().toISOString(),
        seasonId: season.id,
        round: parseRound(fixture.league.round),
        kickoffAt: kickoffAt.toISOString(),
        homeTeamId: homeTeamId ?? "",
        awayTeamId: awayTeamId ?? "",
        homeTeamName: homeTeamId ? teamNameById.get(homeTeamId) ?? fixture.teams.home.name : fixture.teams.home.name,
        awayTeamName: awayTeamId ? teamNameById.get(awayTeamId) ?? fixture.teams.away.name : fixture.teams.away.name,
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        status: normalizeFixtureStatus(fixture.fixture.status.short),
        refereeId: referee?.id ?? null,
        refereeName: referee?.name ?? fixture.fixture.referee ?? null,
        note: "Synchronizacja API-Football",
        stats,
      };

      let status: ImportRowStatus;
      if (errors.length) {
        status = ImportRowStatus.INVALID;
        invalid += 1;
      } else if (!existingMatchId && homeTeamId && awayTeamId) {
        const duplicateMatch = await prisma.match.findFirst({
          where: {
            seasonId: season.id,
            homeTeamId,
            awayTeamId,
            kickoffAt,
          },
          select: { id: true },
        });
        if (duplicateMatch) {
          status = ImportRowStatus.DUPLICATE;
          data.duplicateMatchId = duplicateMatch.id;
          errors.push("Mecz istnieje już bez identyfikatora API. Połącz rekord ręcznie lub usuń duplikat.");
          duplicate += 1;
        } else {
          status = ImportRowStatus.VALID;
          valid += 1;
        }
      } else {
        status = ImportRowStatus.VALID;
        valid += 1;
      }

      rows.push({
        importId: batch.id,
        rowNumber: index + 1,
        status,
        rawData: data as unknown as Prisma.InputJsonValue,
        errors: errors.length ? errors as unknown as Prisma.InputJsonValue : Prisma.DbNull,
      });
    }

    await prisma.$transaction([
      prisma.importRow.createMany({ data: rows }),
      prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status: ImportStatus.READY,
          rowsValid: valid,
          rowsInvalid: invalid,
          rowsDuplicate: duplicate,
        },
      }),
    ]);

    revalidatePath("/automation");
    revalidatePath("/imports");
    successBatchId = batch.id;
  } catch (error) {
    redirect(`/automation?seasonId=${season.id}&error=${apiErrorCode(error)}`);
  }
  redirect(`/imports/${successBatchId}`);
}
