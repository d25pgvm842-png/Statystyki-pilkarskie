import type { NormalizedFixtureStats } from "@/lib/api-football/provider";

export const HISTORICAL_DEFAULT_SEASONS = [2023, 2024, 2025] as const;
export const HISTORICAL_API_BATCH_SIZE = 20;
export const HISTORICAL_COMMIT_CHUNK_SIZE = 5;

export type HistoricalDetailMode = "BATCH_IDS" | "SINGLE_ID";

export function batchIdsUnavailable(message: string) {
  return /free plans? do not have access to the ids parameter/i.test(message)
    || /ids parameter.*(?:free|not available|not accessible)/i.test(message);
}

export function historicalDetailSelection(
  fixtureIds: readonly number[],
  cursor: number,
  mode: HistoricalDetailMode,
) {
  return mode === "SINGLE_ID"
    ? nextFixtureChunk(fixtureIds, cursor, 1)
    : nextFixtureChunk(fixtureIds, cursor);
}

export function historicalRequestDelay(
  mode: HistoricalDetailMode,
  apiRequests: number,
) {
  return mode === "SINGLE_ID" && apiRequests > 0 ? 6_500 : 250;
}

export function historicalSeasonName(providerSeason: number) {
  const next = String(providerSeason + 1).slice(-2);
  return `${providerSeason}/${next}`;
}

export function finishedFixtureIds(
  fixtures: Array<{
    fixture: {
      id: number;
      status: { short: string };
    };
  }>,
) {
  const finished = new Set(["FT", "AET", "PEN"]);
  const ids = new Set<number>();
  for (const fixture of fixtures) {
    if (
      Number.isInteger(fixture.fixture.id)
      && fixture.fixture.id > 0
      && finished.has(fixture.fixture.status.short.toUpperCase())
    ) {
      ids.add(fixture.fixture.id);
    }
  }
  return [...ids].sort((left, right) => left - right);
}

export function nextFixtureChunk(
  fixtureIds: readonly number[],
  cursor: number,
  maximum = HISTORICAL_API_BATCH_SIZE,
) {
  const safeCursor = Math.max(0, Math.trunc(cursor));
  const safeMaximum = Math.max(1, Math.min(
    HISTORICAL_API_BATCH_SIZE,
    Math.trunc(maximum),
  ));
  return fixtureIds.slice(safeCursor, safeCursor + safeMaximum);
}

function completePair(
  stats: NormalizedFixtureStats,
  home: keyof NormalizedFixtureStats,
  away: keyof NormalizedFixtureStats,
) {
  return stats[home] !== null && stats[away] !== null;
}

export function historicalCoverage(
  values: readonly NormalizedFixtureStats[],
) {
  let corners = 0;
  let cards = 0;
  let shots = 0;
  let fouls = 0;
  let offsides = 0;

  for (const stats of values) {
    if (completePair(stats, "homeCorners", "awayCorners")) corners += 1;
    if (
      completePair(stats, "homeYellowCards", "awayYellowCards")
      && completePair(stats, "homeRedCards", "awayRedCards")
    ) cards += 1;
    if (
      completePair(stats, "homeShots", "awayShots")
      && completePair(stats, "homeShotsOnTarget", "awayShotsOnTarget")
    ) shots += 1;
    if (completePair(stats, "homeFouls", "awayFouls")) fouls += 1;
    if (completePair(stats, "homeOffsides", "awayOffsides")) offsides += 1;
  }

  return { corners, cards, shots, fouls, offsides };
}

export function percentage(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((Math.max(0, count) / total) * 1000) / 10;
}
