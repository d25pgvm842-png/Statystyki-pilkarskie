# Sprint 1.16 — Analityka Dziennika

## Dodane

- analityka według ligi, rynku, kierunku OVER/UNDER, źródła i statusu historycznego,
- liczba pozycji, bilans, hit rate, obrót, wynik, ROI, średni kurs i średnie CLV,
- filtry ligi, sezonu, rynku, źródła, statusu i zakresu dat,
- oznaczenie małej próby poniżej 10 rozliczonych pozycji,
- osobny eksport analityki do CSV,
- testy grupowania oraz zasad liczenia ROI.

## Zasady

- hit rate korzysta tylko z WIN i LOSS,
- PUSH nie trafia do mianownika hit rate,
- ROI wymaga rozliczonego wyniku, prawidłowej stawki i kursu,
- brak kursu lub stawki nie jest zamieniany na zero,
- filtry dotyczą jednocześnie kart, analityki, listy i eksportów.

## Bezpieczeństwo danych

- brak migracji bazy,
- brak zmian modelu AnalysisPick,
- brak modyfikacji istniejących wpisów,
- null nadal oznacza brak danych,
- ręczne korekty i historia sezonów pozostają bez zmian.
