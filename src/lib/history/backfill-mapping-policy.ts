export type HistoricalMappingSide = "home" | "away";

export type HistoricalMappingCandidate = {
  id: string;
  name: string;
  score: number;
};

export type HistoricalTeamAmbiguity = {
  provider: string;
  seasonId: string;
  side: HistoricalMappingSide;
  externalId: string;
  externalName: string;
  shortName: string | null;
  country: string | null;
  candidates: HistoricalMappingCandidate[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as UnknownRecord
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function teamAmbiguity(
  data: UnknownRecord,
  side: HistoricalMappingSide,
): HistoricalTeamAmbiguity | null {
  const candidate = record(
    data[side === "home" ? "homeTeamCandidate" : "awayTeamCandidate"],
  );
  if (!candidate) return null;

  const provider = stringValue(data.provider);
  const seasonId = stringValue(data.seasonId);
  const externalId = stringValue(candidate.externalId);
  const externalName = stringValue(candidate.name);
  const ambiguous = Array.isArray(candidate.ambiguousMatches)
    ? candidate.ambiguousMatches
    : [];

  if (!provider || !seasonId || !externalId || !externalName) return null;

  const candidates = ambiguous.flatMap((item) => {
    const value = record(item);
    if (!value) return [];
    const id = stringValue(value.id);
    const name = stringValue(value.name);
    const score = numberValue(value.score);
    return id && name && score !== null ? [{ id, name, score }] : [];
  });

  if (!candidates.length) return null;

  return {
    provider,
    seasonId,
    side,
    externalId,
    externalName,
    shortName: stringValue(candidate.shortName),
    country: stringValue(candidate.country),
    candidates,
  };
}

export function historicalTeamAmbiguities(value: unknown) {
  const data = record(value);
  if (!data) return [];

  return (["home", "away"] as const).flatMap((side) => {
    const ambiguity = teamAmbiguity(data, side);
    return ambiguity ? [ambiguity] : [];
  });
}

export function isAllowedHistoricalMappingTarget(
  ambiguity: HistoricalTeamAmbiguity,
  teamId: string,
) {
  return ambiguity.candidates.some((candidate) => candidate.id === teamId);
}
