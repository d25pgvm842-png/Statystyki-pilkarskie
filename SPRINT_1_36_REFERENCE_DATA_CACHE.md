# Sprint 1.36 — cache danych referencyjnych

Wersja: 0.38.0

## Diagnoza

Dashboard nie wykonuje pełnego skanu historii. Zapytania są ograniczone do
bieżącego dnia, najbliższych meczów i maksymalnie ośmiu rekordów.

Powtarzalnym kosztem na stronach użytkowych są natomiast te same listy:

- aktywne ligi,
- sezony,
- aktywne drużyny,
- aktywni sędziowie.

Listy były pobierane ponownie przy każdym wejściu na Mecze, Dane, Analizę
i Sędziów.

## Zakres

- wspólny cache Next.js dla danych referencyjnych,
- czas odświeżania 300 sekund,
- osobne klucze i tagi dla lig, sezonów, drużyn i sędziów,
- małe, jawne selekty bez ciężkich relacji i dat w wyniku cache,
- zachowanie dotychczasowego sortowania i filtrów,
- testy filtrów sezonów,
- brak cache dla meczów, statystyk, dziennika i danych użytkownika.

## Kryteria akceptacji

- wersja aplikacji wynosi 0.38.0,
- strony /matches, /data-quality, /analysis i /referees używają wspólnych loaderów,
- zmiana ligi nadal zawęża listę sezonów,
- Analiza nadal pokazuje tylko sezony aktywnych lig,
- cache wygasa automatycznie po maksymalnie pięciu minutach,
- typecheck, lint, testy i build kończą się poprawnie.
