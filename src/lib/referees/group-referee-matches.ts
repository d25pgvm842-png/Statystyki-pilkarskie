export type RefereeMatchGroupRow = {
  refereeId: string | null;
};

export function groupRefereeMatches<T extends RefereeMatchGroupRow>(
  matches: readonly T[],
  limit: number | null,
) {
  const grouped = new Map<string, T[]>();

  for (const match of matches) {
    if (!match.refereeId) continue;

    const refereeMatches = grouped.get(match.refereeId) ?? [];

    if (limit === null || refereeMatches.length < limit) {
      refereeMatches.push(match);
      grouped.set(match.refereeId, refereeMatches);
    }
  }

  return grouped;
}
