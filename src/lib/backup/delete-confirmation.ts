export const DELETE_MATCH_CONFIRMATION = "USUN MECZ";

export function isDeleteMatchConfirmationValid(value: unknown) {
  return String(value ?? "").trim().toUpperCase() === DELETE_MATCH_CONFIRMATION;
}
