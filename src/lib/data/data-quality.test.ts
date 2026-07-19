import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDataQualityContext,
  countMissingExpectedReferees,
  countSourceLimitedMatches,
  findDataQualityIssues,
  hasCompleteRequiredStats,
} from "@/lib/data/data-quality";

type QualityMatch = Parameters<typeof findDataQualityIssues>[0][number];

type MatchInput = {
  id?: string;
  providerCode?: string | null;
  sourceName?: string;
  dataSourceId?: string | null;
  refereeId?: string | null;
  homeOffsides?: number | null;
  awayOffsides?: number | null;
  homeCorners?: number | null;
  awayCorners?: number | null;
  homeFouls?: number | null;
  awayFouls?: number | null;
  seasonId?: string;
  leagueId?: string;
  seasonName?: string;
  leagueName?: string;
};

function createMatch(input: MatchInput = {}) {
  const id = input.id ?? "match-1";
  const providerCode = input.providerCode === undefined
    ? "football-data-co-uk"
    : input.providerCode;
  const dataSourceId = input.dataSourceId === undefined ? "source-1" : input.dataSourceId;
  const defaultOffsides = providerCode === "football-data-co-uk" ? null : 1;
  const seasonId = input.seasonId ?? "season-1";
  const leagueId = input.leagueId ?? "league-1";

  return {
    id,
    seasonId,
    round: 1,
    kickoffAt: new Date(`2025-08-${String((Number(id.replace(/\D/g, "")) % 20) + 1).padStart(2, "0")}T20:00:00.000Z`),
    homeTeamId: `home-${id}`,
    awayTeamId: `away-${id}`,
    homeScore: 2,
    awayScore: 1,
    status: "FINISHED",
    refereeId: input.refereeId === undefined ? "referee-1" : input.refereeId,
    dataSourceId,
    sourceExternalId: `external-${id}`,
    sourceUpdatedAt: new Date("2025-08-15T22:00:00.000Z"),
    note: null,
    createdAt: new Date("2025-08-15T22:00:00.000Z"),
    updatedAt: new Date("2025-08-15T22:00:00.000Z"),
    dataSource: dataSourceId
      ? {
          id: dataSourceId,
          name: input.sourceName ?? "Football-Data.co.uk",
          type: "API",
          providerCode,
          active: true,
          createdAt: new Date("2025-08-15T22:00:00.000Z"),
          updatedAt: new Date("2025-08-15T22:00:00.000Z"),
        }
      : null,
    stats: {
      id: `stats-${id}`,
      matchId: id,
      homeCorners: input.homeCorners === undefined ? 5 : input.homeCorners,
      awayCorners: input.awayCorners === undefined ? 3 : input.awayCorners,
      homeYellowCards: 2,
      awayYellowCards: 1,
      homeRedCards: 0,
      awayRedCards: 0,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 3,
      homeShots: 13,
      awayShots: 8,
      homeFouls: input.homeFouls === undefined ? 10 : input.homeFouls,
      awayFouls: input.awayFouls === undefined ? 12 : input.awayFouls,
      homeOffsides: input.homeOffsides === undefined ? defaultOffsides : input.homeOffsides,
      awayOffsides: input.awayOffsides === undefined ? defaultOffsides : input.awayOffsides,
      createdAt: new Date("2025-08-15T22:00:00.000Z"),
      updatedAt: new Date("2025-08-15T22:00:00.000Z"),
    },
    season: {
      id: seasonId,
      leagueId,
      name: input.seasonName ?? "2025/26",
      startsAt: new Date("2025-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T23:59:59.000Z"),
      active: false,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
      league: {
        id: leagueId,
        name: input.leagueName ?? "Premier League",
        code: "ENG1",
        country: "Anglia",
        active: true,
        createdAt: new Date("2025-07-01T00:00:00.000Z"),
        updatedAt: new Date("2025-07-01T00:00:00.000Z"),
      },
    },
    homeTeam: {
      id: `home-${id}`,
      name: `Home ${id}`,
      shortName: null,
      slug: `home-${id}`,
      country: "Anglia",
      active: true,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
    },
    awayTeam: {
      id: `away-${id}`,
      name: `Away ${id}`,
      shortName: null,
      slug: `away-${id}`,
      country: "Anglia",
      active: true,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
    },
  } as unknown as QualityMatch;
}

function createMany(count: number, factory: (index: number) => MatchInput) {
  return Array.from({ length: count }, (_, index) => createMatch({
    id: `match-${index + 1}`,
    ...factory(index),
  }));
}

test("Football-Data.co.uk nie generuje ostrzeżenia wyłącznie za brak spalonych", () => {
  const match = createMatch();
  assert.equal(findDataQualityIssues([match]).length, 0);
  assert.equal(countSourceLimitedMatches([match]), 1);
  assert.equal(hasCompleteRequiredStats(match), true);
});

test("brak obsługiwanej statystyki nadal generuje ostrzeżenie", () => {
  const match = createMatch({ homeCorners: null });
  const issues = findDataQualityIssues([match]);
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /rożne gospodarzy/);
  assert.equal(hasCompleteRequiredStats(match), false);
});

test("inne źródło w małej próbie nadal wymaga spalonych", () => {
  const match = createMatch({
    providerCode: "csv-import",
    sourceName: "Import CSV",
    homeOffsides: null,
    awayOffsides: null,
  });
  const issues = findDataQualityIssues([match]);
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /spalone gospodarzy/);
  assert.equal(countSourceLimitedMatches([match]), 0);
  assert.equal(hasCompleteRequiredStats(match), false);
});

test("brak dataSource nie psuje starszych wywołań", () => {
  const match = createMatch({
    dataSourceId: null,
    providerCode: null,
    homeOffsides: 1,
    awayOffsides: 2,
  });
  delete (match as { dataSource?: unknown }).dataSource;
  assert.equal(findDataQualityIssues([match]).length, 0);
  assert.equal(hasCompleteRequiredStats(match), true);
});

test("źródło bez sędziów nie generuje setek ostrzeżeń meczowych", () => {
  const matches = createMany(20, () => ({ refereeId: null }));
  const context = buildDataQualityContext(matches);
  const issues = findDataQualityIssues(matches, context);

  assert.equal(issues.filter((issue) => issue.type === "BRAK_SĘDZIEGO").length, 0);
  assert.equal(countMissingExpectedReferees(matches, context), 0);
  assert.equal(countSourceLimitedMatches(matches, context), 20);
  assert.equal(context.profiles[0]?.referee.supported, false);
  assert.ok(context.profiles[0]?.limitations.includes("sędzia"));
});

test("pojedyncze braki sędziego są wykrywane, gdy źródło zwykle go dostarcza", () => {
  const matches = createMany(20, (index) => ({
    refereeId: index < 18 ? `referee-${index}` : null,
  }));
  const context = buildDataQualityContext(matches);
  const issues = findDataQualityIssues(matches, context);

  assert.equal(context.profiles[0]?.referee.supported, true);
  assert.equal(issues.filter((issue) => issue.type === "BRAK_SĘDZIEGO").length, 2);
  assert.equal(countMissingExpectedReferees(matches, context), 2);
});

test("źródło bez całej kategorii statystyk pokazuje ograniczenie zamiast 20 ostrzeżeń", () => {
  const matches = createMany(20, () => ({
    providerCode: "custom-provider",
    sourceName: "Custom Provider",
    homeFouls: null,
    awayFouls: null,
  }));
  const context = buildDataQualityContext(matches);
  const issues = findDataQualityIssues(matches, context);

  assert.equal(issues.filter((issue) => issue.type === "BRAKUJĄCE_STATYSTYKI").length, 0);
  assert.ok(context.profiles[0]?.limitations.includes("faule"));
});

test("rzadkie braki statystyki są ostrzeżeniem, gdy pokrycie źródła jest wysokie", () => {
  const matches = createMany(20, (index) => ({
    providerCode: "custom-provider",
    sourceName: "Custom Provider",
    homeCorners: index < 18 ? 5 : null,
  }));
  const context = buildDataQualityContext(matches);
  const issues = findDataQualityIssues(matches, context);

  assert.equal(context.profiles[0]?.stats.homeCorners.supported, true);
  assert.equal(issues.filter((issue) => issue.type === "BRAKUJĄCE_STATYSTYKI").length, 2);
});
