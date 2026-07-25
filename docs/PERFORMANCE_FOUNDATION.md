# Sprint 1.32 — Performance Foundation

Wersja: 0.34.0

## Zakres

- jeden współdzielony zestaw zakończonych meczów sezonu dla Centrum analizy, warsztatu rynku i korekty siłą rywali,
- deduplikacja pobierania tego samego sezonu w obrębie jednego renderu,
- limitowanie zapytania Trendów zgodnie z wybranym lookbackiem,
- indeksy PostgreSQL pod sezon, status, datę, sędziego i historię audytu,
- logowanie operacji serwerowych trwających co najmniej 750 ms,
- test kontraktowy chroniący najważniejsze ograniczenia wydajności.

## Niezmienione zasady danych

- `null` nadal oznacza brak danych,
- ręczne korekty i historia sezonów nie są nadpisywane,
- obliczenia analityczne korzystają z tych samych zakończonych meczów co przed sprintem,
- H2H nadal może obejmować wcześniejsze sezony,
- profil sędziego nadal może obejmować mecze spoza bieżącego sezonu.
