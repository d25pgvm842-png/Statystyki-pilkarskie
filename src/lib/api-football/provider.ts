import { MatchStatus } from "@/generated/prisma/enums";

export const API_FOOTBALL_PROVIDER_CODE = "api-football";

export const API_FOOTBALL_LEAGUE_IDS: Record<string, number> = {
  PL1: 106,
  ENG1: 39,
  ESP1: 140,
  ITA1: 135,
  GER1: 78,
  FRA1: 61,
};

export type ApiFootballTeam = {
  team: {
    id: number;
    name: string;
    code?: string | null;
    country?: string | null;
  };
};

export type ApiFootballFixture = {
  fixture: {
    id: number;
    referee?: string | null;
    date: string;
    status: {
      short: string;
      long?: string;
    };
  };
  league: {
    id: number;
    season: number;
    round?: string | null;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  statistics?: Array<{
    team: { id: number };
    statistics: Array<{ type: string; value: number | string | null }>;
  }>;
};

export type NormalizedFixtureStats = {
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

const emptyStats = (): NormalizedFixtureStats => ({
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
});

function integer(value: number | string | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace("%", "").trim());
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

function statMap(fixture: ApiFootballFixture, teamId: number) {
  const block = fixture.statistics?.find((item) => item.team.id === teamId);
  return new Map((block?.statistics ?? []).map((item) => [item.type.toLowerCase(), integer(item.value)]));
}

function first(map: Map<string, number | null>, names: string[]) {
  for (const name of names) {
    if (map.has(name)) return map.get(name) ?? null;
  }
  return null;
}

export function normalizeFixtureStats(fixture: ApiFootballFixture): NormalizedFixtureStats {
  if (!fixture.statistics?.length) return emptyStats();
  const home = statMap(fixture, fixture.teams.home.id);
  const away = statMap(fixture, fixture.teams.away.id);

  return {
    homeCorners: first(home, ["corner kicks", "corners"]),
    awayCorners: first(away, ["corner kicks", "corners"]),
    homeYellowCards: first(home, ["yellow cards"]),
    awayYellowCards: first(away, ["yellow cards"]),
    homeRedCards: first(home, ["red cards"]),
    awayRedCards: first(away, ["red cards"]),
    homeShotsOnTarget: first(home, ["shots on goal", "shots on target"]),
    awayShotsOnTarget: first(away, ["shots on goal", "shots on target"]),
    homeShots: first(home, ["total shots"]),
    awayShots: first(away, ["total shots"]),
    homeFouls: first(home, ["fouls"]),
    awayFouls: first(away, ["fouls"]),
    homeOffsides: first(home, ["offsides"]),
    awayOffsides: first(away, ["offsides"]),
  };
}

export function normalizeFixtureStatus(short: string): MatchStatus {
  const status = short.toUpperCase();
  if (["FT", "AET", "PEN"].includes(status)) return MatchStatus.FINISHED;
  if (["1H", "HT", "2H", "ET", "P", "BT", "LIVE", "INT"].includes(status)) return MatchStatus.LIVE;
  if (["PST", "SUSP"].includes(status)) return MatchStatus.POSTPONED;
  if (["CANC", "ABD", "AWD", "WO"].includes(status)) return MatchStatus.CANCELLED;
  return MatchStatus.SCHEDULED;
}

export function parseRound(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/(\d+)(?!.*\d)/);
  return match ? Number(match[1]) : null;
}

export function apiSeasonYear(startsAt: Date) {
  return startsAt.getUTCFullYear();
}
