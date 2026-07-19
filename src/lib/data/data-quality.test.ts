import assert from "node:assert/strict";
import test from "node:test";
import {
  countSourceLimitedMatches,
  findDataQualityIssues,
  hasCompleteRequiredStats,
} from "@/lib/data/data-quality";

type QualityMatch = Parameters<typeof findDataQualityIssues>[0][number];

function createMatch(input?: {
  providerCode?: string | null;
  homeOffsides?: number | null;
  awayOffsides?: number | null;
  homeCorners?: number | null;
}) {
  const providerCode = input?.providerCode === undefined
    ? "football-data-co-uk"
    : input.providerCode;
  return {
    id: "match-1",
    seasonId: "season-1",
    round: 1,
    kickoffAt: new Date("2025-08-15T20:00:00.000Z"),
    homeTeamId: "home-1",
    awayTeamId: "away-1",
    homeScore: 2,
    awayScore: 1,
    status: "FINISHED",
    refereeId: "referee-1",
    dataSourceId: "source-1",
    sourceExternalId: "external-1",
    sourceUpdatedAt: new Date("2025-08-15T22:00:00.000Z"),
    note: null,
    createdAt: new Date("2025-08-15T22:00:00.000Z"),
    updatedAt: new Date("2025-08-15T22:00:00.000Z"),
    dataSource: {
      id: "source-1",
      name: "Football-Data.co.uk",
      type: "API",
      providerCode,
      active: true,
      createdAt: new Date("2025-08-15T22:00:00.000Z"),
      updatedAt: new Date("2025-08-15T22:00:00.000Z"),
    },
    stats: {
      id: "stats-1",
      matchId: "match-1",
      homeCorners: input?.homeCorners === undefined ? 5 : input.homeCorners,
      awayCorners: 3,
      homeYellowCards: 2,
      awayYellowCards: 1,
      homeRedCards: 0,
      awayRedCards: 0,
      homeShotsOnTarget: 6,
      awayShotsOnTarget: 3,
      homeShots: 13,
      awayShots: 8,
      homeFouls: 10,
      awayFouls: 12,
      homeOffsides: input?.homeOffsides === undefined ? null : input.homeOffsides,
      awayOffsides: input?.awayOffsides === undefined ? null : input.awayOffsides,
      createdAt: new Date("2025-08-15T22:00:00.000Z"),
      updatedAt: new Date("2025-08-15T22:00:00.000Z"),
    },
    season: {
      id: "season-1",
      leagueId: "league-1",
      name: "2025/26",
      startsAt: new Date("2025-07-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-30T23:59:59.000Z"),
      active: false,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
      league: {
        id: "league-1",
        name: "Premier League",
        code: "ENG1",
        country: "Anglia",
        active: true,
        createdAt: new Date("2025-07-01T00:00:00.000Z"),
        updatedAt: new Date("2025-07-01T00:00:00.000Z"),
      },
    },
    homeTeam: {
      id: "home-1",
      name: "Liverpool",
      shortName: null,
      slug: "liverpool",
      country: "Anglia",
      active: true,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
    },
    awayTeam: {
      id: "away-1",
      name: "Bournemouth",
      shortName: null,
      slug: "bournemouth",
      country: "Anglia",
      active: true,
      createdAt: new Date("2025-07-01T00:00:00.000Z"),
      updatedAt: new Date("2025-07-01T00:00:00.000Z"),
    },
  } as unknown as QualityMatch;
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

test("inne źródło nadal wymaga spalonych", () => {
  const match = createMatch({ providerCode: "csv-import" });
  const issues = findDataQualityIssues([match]);
  assert.equal(issues.length, 1);
  assert.match(issues[0]?.message ?? "", /spalone gospodarzy/);
  assert.equal(countSourceLimitedMatches([match]), 0);
  assert.equal(hasCompleteRequiredStats(match), false);
});

test("brak dataSource nie psuje starszych wywołań", () => {
  const match = createMatch({ homeOffsides: 1, awayOffsides: 2 });
  delete (match as { dataSource?: unknown }).dataSource;
  assert.equal(findDataQualityIssues([match]).length, 0);
  assert.equal(hasCompleteRequiredStats(match), true);
});
