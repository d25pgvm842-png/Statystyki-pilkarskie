# Sprint 1.19 — Warsztat rynku, fair odds i EV

## Cel

Połączyć analizę statystyczną z ręcznie wpisaną ofertą bukmachera: linia, kursy, prawdopodobieństwo modelu, kurs fair, marża, no-vig i EV.

## Model v1

- obsługuje wyłącznie linie połówkowe,
- nie zakłada automatycznie rozkładu Poissona,
- buduje empiryczne rozkłady z wcześniejszych meczów,
- łączy wyniki wykonywane przez drużynę z wartościami oddawanymi przez przeciwnika,
- dla sumy meczu łączy rozkład gospodarza i gościa,
- przesuwa rozkład do projekcji skorygowanej siłą rywali,
- stosuje wygładzenie Beta(1,1),
- nie używa meczów rozegranych po analizowanym spotkaniu.

## Progi

- EV poniżej 2%: brak przewagi,
- EV od 2%: obserwacja,
- EV od 5%: potencjalne value tylko przy minimum 10 obserwacjach, pokryciu minimum 70%, co najmniej średniej wiarygodności i przewadze modelu nad rynkiem minimum 3 pp.

## Snapshot Dziennika

Zapis obejmuje drużynę, linię, stronę, oba kursy, czas pobrania, surową i skorygowaną projekcję, prawdopodobieństwo, fair odds, marżę, no-vig, EV, próbę, pokrycie, wiarygodność, status i wersję modelu.

Późniejsza zmiana modelu nie przelicza historycznego wpisu.

## Bezpieczeństwo

- nowe pola są opcjonalne,
- starsze wpisy zachowują `null`,
- `null` nie staje się zerem,
- zakład na gospodarza i gościa ma odrębny fingerprint,
- ręczne korekty i historia sezonów pozostają bez zmian.
