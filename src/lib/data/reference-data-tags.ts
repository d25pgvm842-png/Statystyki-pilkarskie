export const REFERENCE_DATA_CACHE_TAGS = {
  all: "reference-data",
  leagues: "reference-data-leagues",
  seasons: "reference-data-seasons",
  teams: "reference-data-teams",
  referees: "reference-data-referees",
} as const;

export type ReferenceDataMutation =
  | "league-created"
  | "league-visibility-changed"
  | "season-changed"
  | "team-changed"
  | "referee-changed";

export function referenceDataTagsForMutation(
  mutation: ReferenceDataMutation,
): readonly string[] {
  if (mutation === "league-created") {
    return [REFERENCE_DATA_CACHE_TAGS.leagues];
  }
  if (mutation === "league-visibility-changed") {
    return [
      REFERENCE_DATA_CACHE_TAGS.leagues,
      REFERENCE_DATA_CACHE_TAGS.seasons,
    ];
  }
  if (mutation === "season-changed") {
    return [REFERENCE_DATA_CACHE_TAGS.seasons];
  }
  if (mutation === "team-changed") {
    return [REFERENCE_DATA_CACHE_TAGS.teams];
  }
  return [REFERENCE_DATA_CACHE_TAGS.referees];
}
