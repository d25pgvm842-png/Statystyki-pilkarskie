# Sprint 1.12 — ratingi rynkowe i benchmark ligi

## Cel

Zamienić surowe średnie w warstwę porównawczą, która pokazuje pozycję drużyny
na tle konkretnej ligi, sezonu, rynku, perspektywy oraz miejsca rozgrywania meczu.

## Funkcje

- nowa zakładka `Rankingi`,
- rating 0–100 oparty na percentylu,
- osobne rankingi dla:
  - wartości wykonywanych przez drużynę,
  - wartości oddawanych rywalom,
  - sumy zdarzeń w meczach drużyny,
- splity ogółem, dom i wyjazd,
- zakresy ostatnie 5, 10, 20 lub cały sezon,
- minimalna próba 1, 3, 5 lub 10,
- średnia ligi, różnica bezwzględna i procentowa,
- mediana oraz min–max,
- cztery koszyki interpretacyjne,
- jakość próby,
- CSV,
- profil siedmiu rynków na stronie drużyny.

## Zasady modelu

- wyższy rating oznacza wyższą wartość statystyki, nie lepszą drużynę,
- `null` jest pomijany i nigdy nie staje się zerem,
- drużyna poniżej minimalnej próby zachowuje średnią informacyjną, ale nie dostaje ratingu,
- remisy otrzymują ten sam percentyl i pozycję,
- percentyle są liczone wyłącznie w obrębie wybranej ligi i sezonu,
- logika obsługuje granicę czasu `before`, aby mogła zostać użyta w przyszłym backtesterze bez wycieku danych.

## Brak migracji

Ratingi są liczone dynamicznie z zakończonych meczów. Sprint nie dodaje tabel
ani nie zapisuje pochodnych wartości do bazy.
