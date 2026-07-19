/**
 * Daty meczów są traktowane jako czas "ścienny" wpisany przez użytkownika.
 * Nie wolno przesuwać wartości pola datetime-local względem strefy przeglądarki,
 * ponieważ serwer produkcyjny zapisuje ją w tej samej reprezentacji ISO/UTC.
 */
export function kickoffInputValue(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}
