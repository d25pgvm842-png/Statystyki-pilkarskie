# Hotfix 0.19.1 — Dziennik i historia poprzedniego sezonu

## Naprawione problemy

- Dziennik jest dostępny bez względu na liczbę kandydatów Skanera.
- Przycisk `Do dziennika` znajduje się bezpośrednio przy meczu.
- Brak lub słaba kalibracja nie wygląda już jak blokada zapisu.
- Pusty wynik Skanera prowadzi do ręcznego formularza Dziennika.
- Dziennik ma szybki skrót do ręcznego formularza.
- Przy świeżym sezonie Skaner korzysta z zakończonych meczów bieżącego i bezpośrednio poprzedniego sezonu tej samej ligi.

## Bezpieczeństwo danych

- brak migracji bazy,
- brak zmian modelu `AnalysisPick`,
- brak modyfikacji istniejących wpisów,
- `null` nadal oznacza brak danych,
- historia sezonów nie jest nadpisywana.
