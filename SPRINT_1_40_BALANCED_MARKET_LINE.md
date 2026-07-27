# Sprint 1.40 — automatyczna linia najbliższa 50/50

Wersja: 0.40.0

## Cel

Warsztat rynku buduje już empiryczny rozkład statystyki, koryguje projekcję
siłą wcześniejszych rywali oraz liczy prawdopodobieństwa, kursy fair, no-vig
i EV dla ręcznie wpisanej linii. Sprint dodaje automatyczne wskazanie linii
połówkowej, dla której strony over i under są według tego samego modelu
najbliżej równowagi.

## Zakres

- rekomendacja linii połówkowej z istniejącego rozkładu,
- wygładzenie Beta zgodne z Warsztatem,
- prawdopodobieństwa oraz kursy fair over i under,
- jawne odchylenie od 50%,
- deterministyczny wybór przy remisie,
- przycisk ustawiający rekomendowaną linię,
- wyczyszczenie wcześniejszych kursów po zmianie linii,
- brak automatycznego typowania,
- brak zmian w bazie danych.

## Ochrona jakości

- null pozostaje brakiem danych,
- mecze po dacie analizowanego spotkania nie są używane,
- błędne i ujemne wartości nie są zamieniane na zero,
- bramka Raw SQL pozostaje częścią pełnego verify,
- typecheck, lint, testy i build muszą przejść przed pushem.
