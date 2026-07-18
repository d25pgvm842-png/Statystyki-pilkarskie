# Architektura aplikacji

## Założenie

Aplikacja jest modularnym monolitem. Jeden projekt Next.js obsługuje interfejs, warstwę serwerową i API. Logika domenowa nie trafia bezpośrednio do komponentów React. Pozwala to później wydzielić API lub proces synchronizacji bez przepisywania reguł biznesowych.

## Warstwy

1. `src/app` — routing i składanie widoków.
2. `src/components` — interfejs i formularze.
3. `src/lib/actions` — zapis danych, autoryzacja i transakcje.
4. `src/lib/data` — odczyty, kontrola jakości i przyszłe repozytoria.
5. `src/lib/stats` — czyste obliczenia statystyczne.
6. `src/lib/validation` — walidacja Zod po stronie serwera.
7. `prisma` — model danych, migracje i dane startowe.

## Najważniejsze decyzje

- Liga i sezon są osobnymi encjami. Mecz zawsze należy do sezonu.
- Przynależność drużyny do sezonu zapisuje `SeasonTeam`.
- Przynależność sędziego do sezonu zapisuje `RefereeSeason`.
- Statystyki meczu mają osobne kolumny. Nie są przechowywane w JSON.
- Duplikaty blokuje ograniczenie unikalne: sezon, gospodarz, gość i termin.
- Każda ręczna edycja tworzy `AuditLog` i `AuditChange`.
- `DataOverride` oznacza pola ręcznie zmienione. Adapter API ma je omijać lub wymagać potwierdzenia.
- Importy mają własny batch i rekordy podglądu. Surowy wiersz importu może być JSON, bo nie służy do analiz.
- Klucze dostawców danych działają tylko po stronie serwera.

## Adaptery danych

Docelowy interfejs adaptera:

```ts
interface FootballDataAdapter {
  provider: string;
  fetchCompetitions(): Promise<ExternalLeague[]>;
  fetchTeams(input: SeasonInput): Promise<ExternalTeam[]>;
  fetchMatches(input: MatchSyncInput): Promise<ExternalMatch[]>;
  normalizeMatch(input: ExternalMatch): NormalizedMatch;
}
```

Warstwa synchronizacji porównuje rekord z bazą, sprawdza `DataOverride`, zapisuje zmianę w audycie i dopiero potem aktualizuje mecz.

## Bezpieczeństwo

- Sesja jest podpisanym JWT w ciasteczku `httpOnly`.
- Każda akcja serwerowa ponownie sprawdza użytkownika.
- Hasła są haszowane bcryptem.
- Walidacja działa po stronie serwera.
- W produkcji `AUTH_SECRET` musi mieć losową wartość minimum 32 znaków.

## Skalowanie

Na początku agregaty są liczone z rekordów meczowych. Gdy liczba danych wzrośnie, bez zmiany interfejsu można dodać widoki materializowane PostgreSQL lub tabelę cache agregatów aktualizowaną po zmianie meczu.
