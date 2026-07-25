# Sprint 1.33 — Referee Performance

Wersja: 0.35.0

## Cel

Usunięcie kosztownego zagnieżdżonego pobierania historii meczów osobno
dla każdego sędziego.

## Zmiany

- jedno zapytanie po przypisania sędziów do sezonu,
- jedno płaskie zapytanie po zakończone mecze sezonu,
- grupowanie i lookback osobno dla każdego sędziego,
- ograniczony `select` zamiast pobierania pełnych rekordów,
- pomiar czasu loadera przez wspólny mechanizm Sprintu 1.32,
- testy zachowania kolejności, limitu i pustego `refereeId`.

## Niezmienione

- obliczenia średnich i pokrycia linii,
- `null` jako brak danych,
- linki do szczegółów meczu,
- możliwość analizy całego sezonu.
