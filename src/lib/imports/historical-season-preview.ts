export type HistoricalLeaguePreview = {
  id: string;
  name: string;
  code: string;
  country: string;
};

export type HistoricalSeasonCandidate = {
  leagueId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  active: false;
};

export function buildHistoricalSeasonPreview(input: {
  league: HistoricalLeaguePreview;
  startYear: number;
  name: string;
}) {
  const startsAt = new Date(Date.UTC(input.startYear, 6, 1));
  const endsAt = new Date(Date.UTC(input.startYear + 1, 5, 30, 23, 59, 59));

  return {
    id: `pending-season:${input.league.id}:${input.startYear}`,
    leagueId: input.league.id,
    startsAt,
    endsAt,
    league: input.league,
    seasonCandidate: {
      leagueId: input.league.id,
      name: input.name,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      active: false,
    } satisfies HistoricalSeasonCandidate,
  };
}
