# Sprint 1.17 — dynamiczne koszyki siły rynkowej

## Cel

Zamienić opisowe koszyki ratingów na jawny, dynamiczny podział 1–4 zależny od konkretnej konfiguracji analizy.

## Dodane

- koszyk 1–4 dla każdej drużyny,
- koszyki liczone osobno dla ligi, sezonu, rynku, perspektywy, miejsca, lookbacku i minimum próby,
- jawna reguła percentylowa:
  - K1: P75–P100,
  - K2: P50–<P75,
  - K3: P25–<P50,
  - K4: P0–<P25,
- zachowanie remisów w tym samym percentylu i koszyku,
- podsumowanie liczebności oraz zakresu średnich w każdym koszyku,
- filtr tabeli po koszyku,
- numer i opis koszyka w eksporcie CSV,
- testy podziału, remisów, braków danych i minimum próby.

## Interpretacja

Koszyk 1 oznacza najwyższą wartość wybranej statystyki w danej konfiguracji. Nie oznacza automatycznie najlepszej drużyny piłkarsko.

Dla zakresu `TEAM_AGAINST` wysoki koszyk oznacza wysoką wartość oddawaną rywalom. Dla kartek, fauli lub innych rynków wysoka wartość może być negatywną cechą sportową, ale nadal istotną rynkowo.

## Bezpieczeństwo danych

- brak migracji bazy,
- brak zapisu wartości pochodnych,
- brak modyfikacji historii sezonów,
- `null` pozostaje brakiem danych,
- drużyna niespełniająca minimum próby nie dostaje koszyka,
- granica czasu `before` nadal chroni backtest przed wyciekiem danych.
