# Sprint 1.34 — Journal Pagination

Wersja: 0.36.0

## Cel

Dziennik decyzji nie może pobierać pełnych kart wszystkich pozycji
przy każdym wejściu na stronę.

## Zmiany

- lista Dziennika jest dzielona na strony po 50 pozycji,
- liczba stron wynika z `count`, bez zgadywania po stronie interfejsu,
- pełne relacje meczu są pobierane tylko dla aktualnej strony,
- analityka korzysta z osobnego lekkiego `select`,
- analityka pełnej historii ma limit 5000 najnowszych pozycji,
- przekroczenie limitu jest jawnie pokazane użytkownikowi,
- eksporty i kalibracja mogą nadal używać pełnego loadera,
- oba loadery są objęte pomiarem wolnych operacji.

## Niezmienione

- filtry dat, ligi, sezonu, rynku, źródła i statusu,
- wartości finansowe i CLV,
- `null` jako brak danych,
- edycja oraz ręczne rozliczanie pozycji,
- pełny eksport CSV.
