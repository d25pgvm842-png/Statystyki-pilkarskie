"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { DataSourceType } from "@/generated/prisma/enums";
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
import { requireAdminUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeLookup } from "@/lib/imports/csv";
import { prepareExternalImportBatch } from "@/lib/imports/external-preview";
import { findExternalMapping, replaceExternalMapping } from "@/lib/external-mappings";

const MAX_FIXTURES_PER_BATCH = 20;
const MAX_DATE_RANGE_DAYS = 31;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireAdmin() {
  const user = await requireAdminUser();
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
function automationErrorHref(seasonId: string, error: unknown) {
  const params = new URLSearchParams({
    seasonId,
    error: apiErrorCode(error),
  });

  if (
    error instanceof ApiFootballError
    && error.message !== "NO_TEAMS"
    && error.message !== "NO_FIXTURES"
  ) {
    params.set("detail", error.message.slice(0, 500));
  }

  return `/automation?${params.toString()}`;
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
    redirect(automationErrorHref(season.id, error));
  }
  redirect(successHref);
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
    const fixtureList = await apiFootballGet<ApiFootballFixture[]>("/fixtures", {
      league: leagueId,
      season: apiSeasonYear(season.startsAt),
      from: fromValue,
      to: toValue,
      timezone: "UTC",
    });

    const selected = fixtureList
      .sort((left, right) => left.fixture.date.localeCompare(right.fixture.date))
      .slice(0, limit);
    if (!selected.length) throw new ApiFootballError("NO_FIXTURES");

    let detailed = selected;
    if (includeStats) {
      const ids = selected.map((fixture) => fixture.fixture.id).join("-");
      const response = await apiFootballGet<ApiFootballFixture[]>("/fixtures", { ids });
      const byId = new Map(response.map((fixture) => [fixture.fixture.id, fixture]));
      detailed = selected.map((fixture) => byId.get(fixture.fixture.id) ?? fixture);
    }

    successBatchId = await prepareExternalImportBatch({
      userId: user.id,
      season,
      providerCode: API_FOOTBALL_PROVIDER_CODE,
      providerName: "API-Football",
      externalLeagueId: String(leagueId),
      batchName: `API-Football · ${season.league.name} · ${fromValue}–${toValue}`,
      matches: detailed.map((fixture) => {
        const kickoffAt = new Date(fixture.fixture.date);
        if (Number.isNaN(kickoffAt.getTime())) {
          throw new ApiFootballError("Dostawca zwrócił nieprawidłową datę meczu.");
        }
        return {
          externalId: String(fixture.fixture.id),
          kickoffAt,
          kickoffTimeKnown: true,
          round: parseRound(fixture.league.round),
          home: {
            externalId: String(fixture.teams.home.id),
            name: fixture.teams.home.name,
            country: season.league.country,
          },
          away: {
            externalId: String(fixture.teams.away.id),
            name: fixture.teams.away.name,
            country: season.league.country,
          },
          homeScore: fixture.goals.home,
          awayScore: fixture.goals.away,
          status: normalizeFixtureStatus(fixture.fixture.status.short),
          refereeName: fixture.fixture.referee?.trim() || null,
          note: "Synchronizacja API-Football",
          stats: normalizeFixtureStats(fixture),
        };
      }),
    });

    revalidatePath("/automation");
    revalidatePath("/imports");
  } catch (error) {
    redirect(automationErrorHref(season.id, error));
  }
  redirect(`/imports/${successBatchId}`);
}
