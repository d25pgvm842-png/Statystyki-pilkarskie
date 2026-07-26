# Sprint 1.39 — automatyczna linia 50/50

Wersja: 0.41.0

## Diagnoza

Warsztat rynku już buduje empiryczny rozkład statystyki, koryguje projekcję
siłą wcześniejszych rywali, liczy prawdopodobieństwa, kursy fair, no-vig i EV.
Brakowało automatycznego wskazania linii połówkowej, przy której strony over
i under są według tego samego rozkładu najbliżej 50/50.

## Zakres

- rekomendacja linii połówkowej na istniejącym rozkładzie Warsztatu,
- wygładzenie Beta zgodne z obecnym modelem,
- kursy fair over i under,
- jawne odchylenie od balansu 50/50,
- deterministyczne rozstrzyganie remisów,
- przycisk ustawiający rekomendowaną linię,
- usunięcie starych kursów po zmianie linii,
- brak automatycznego typowania i brak zmian w bazie.

## Kryteria akceptacji

- wersja aplikacji wynosi 0.41.0,
- model ma wersję market-workshop-v1.1,
- Warsztat pokazuje linię najbliższą 50/50,
- pokazuje prawdopodobieństwa i kursy fair obu stron,
- przy braku danych nie proponuje linii,
- null nadal oznacza brak danych,
- typecheck, lint, testy i build kończą się poprawnie.
