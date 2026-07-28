# Hotfix 0.41.3 — ograniczone kroki naprawy historycznej

## Przyczyna

Odzyskiwanie niejednoznacznych drużyn wykonywało wszystkie znalezione
wiersze w jednym żądaniu. W środowisku serverless mogło to przekroczyć
czas funkcji i pozostawić blokadę zadania do trzech minut.

## Poprawka

- jeden błędny wiersz jest naprawiany w jednym kroku,
- klient automatycznie wykonuje następne kroki,
- licznik aktualizuje się po każdym wierszu,
- blokada awaryjna wygasa po 60 sekundach,
- aktywny przycisk pokazuje „Przetwarzanie…”,
- naprawa nie wywołuje API-Football.
