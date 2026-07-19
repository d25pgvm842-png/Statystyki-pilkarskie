export type PreviewTeamCandidate = {
  name: string;
  existingId: string | null;
  requiresMembership: boolean;
  requiresMapping: boolean;
};

export type PreviewRefereeCandidate = {
  name: string;
  existingId: string | null;
  requiresMembership: boolean;
} | null;

export function buildExternalPreviewActions(input: {
  operation: "CREATE" | "UPDATE";
  sourceExists: boolean;
  leagueMappingExists: boolean;
  home: PreviewTeamCandidate;
  away: PreviewTeamCandidate;
  referee: PreviewRefereeCandidate;
  seasonCandidate?: { name: string } | null;
}) {
  const actions: string[] = [
    input.operation === "UPDATE"
      ? "Zaktualizuje istniejący mecz"
      : "Utworzy nowy mecz",
  ];

  if (input.seasonCandidate) actions.push(`Utworzy sezon: ${input.seasonCandidate.name}`);
  if (!input.sourceExists) actions.push("Utworzy źródło danych");
  if (!input.leagueMappingExists) actions.push("Utworzy mapowanie ligi");

  for (const team of [input.home, input.away]) {
    if (!team.existingId) actions.push(`Utworzy drużynę: ${team.name}`);
    if (team.requiresMembership) actions.push(`Przypisze drużynę do sezonu: ${team.name}`);
    if (team.requiresMapping) actions.push(`Utworzy mapowanie drużyny: ${team.name}`);
  }

  if (input.referee) {
    if (!input.referee.existingId) actions.push(`Utworzy sędziego: ${input.referee.name}`);
    if (input.referee.requiresMembership) {
      actions.push(`Przypisze sędziego do sezonu: ${input.referee.name}`);
    }
  }

  return [...new Set(actions)];
}

export function externalCandidateKey(input: {
  internalId?: string | null;
  existingId?: string | null;
  externalId?: string | null;
  name?: string | null;
}) {
  return input.internalId?.trim()
    || input.existingId?.trim()
    || input.externalId?.trim()
    || input.name?.trim().toLocaleLowerCase("pl-PL")
    || "brak";
}
