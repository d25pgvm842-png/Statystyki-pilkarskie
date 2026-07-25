export function filterReferenceSeasonsByLeague<
  T extends { leagueId: string },
>(
  seasons: readonly T[],
  leagueId: string | null | undefined,
) {
  return leagueId
    ? seasons.filter((season) => season.leagueId === leagueId)
    : [...seasons];
}

export function filterReferenceSeasonsByActiveLeague<
  T extends { league: { active: boolean } },
>(seasons: readonly T[]) {
  return seasons.filter((season) => season.league.active);
}
