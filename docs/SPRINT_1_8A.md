# Sprint 1.8A — automatyczne zasilanie API

## Zakres

- integracja z oficjalnym API-Football v3,
- bezpieczny klucz `API_FOOTBALL_KEY` wyłącznie po stronie serwera,
- automatyczne pobieranie i mapowanie drużyn,
- stałe mapowania identyfikatorów lig oraz drużyn,
- pobieranie terminarzy, wyników, sędziów i statystyk meczowych,
- dwa zapytania API na paczkę: lista meczów oraz zbiorcze szczegóły,
- kolejka weryfikacyjna oparta o istniejący moduł importów,
- tworzenie nowych meczów oraz aktualizacja istniejących po ID dostawcy,
- zachowanie ręcznych korekt przez `DataOverride`,
- audyt `SYNC_API_CREATE` i `SYNC_API_UPDATE`,
- ochrona przed duplikatami także po zmianie terminu meczu,
- kopia bezpieczeństwa rozszerzona o mapowania zewnętrzne.

## Obsługiwane ligi

- Ekstraklasa,
- Premier League,
- LaLiga,
- Serie A,
- Bundesliga,
- Ligue 1.

## Bezpieczeństwo

Pobranie danych nie zapisuje ich bezpośrednio jako mecze. Każda paczka trafia najpierw do raportu importu i wymaga zatwierdzenia administratora.
