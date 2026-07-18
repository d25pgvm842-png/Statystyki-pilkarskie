# Etapy budowy

## Etap 1 — fundament i MVP

Gotowe w bieżącej wersji:

- logowanie administratora,
- ligi, sezony, drużyny i sędziowie,
- dodawanie oraz edycja meczu,
- blokada duplikatów,
- historia zmian i ochrona ręcznych poprawek,
- lista i filtrowanie meczów,
- średnie drużyn ogółem, dom i wyjazd,
- podstawowe statystyki sędziów,
- kontrola jakości danych,
- dashboard,
- jasny i ciemny motyw,
- manifest PWA.

## Etap 2 — import danych

- kreator CSV i XLSX,
- mapowanie kolumn,
- podgląd przed zapisem,
- walidacja wierszy,
- wykrywanie duplikatów,
- raport importu,
- zapis i ponowne użycie szablonu mapowania.

## Etap 3 — adaptery API

- wspólny interfejs dostawców,
- pierwszy adapter,
- harmonogram synchronizacji,
- porównanie zmian,
- ochrona ręcznych poprawek,
- log synchronizacji.

## Etap 4 — pełna analityka drużyn i sędziów

- ostatnie 5 i 10 meczów,
- zakres dat i kolejek,
- suma, mediana, min i max we wszystkich widokach,
- średnia ważona i trendy,
- pełne profile sędziów.

## Etap 5 — linie bukmacherskie

- linie domyślne i własne,
- over/under dla meczu i drużyny,
- podział dom/wyjazd/L5/L10,
- zapis zestawów linii.

## Etap 6 — porównanie meczu

- wartości „dla” i „przeciwko”,
- jawny model przewidywanej średniej,
- wpływ formy i liczebności próby,
- statystyki sędziego,
- procent przekroczenia linii.

## Etap 7 — eksport i produkcja

- CSV i XLSX zgodne z filtrami,
- role użytkowników,
- testy integracyjne,
- monitoring i backup,
- pełny service worker PWA,
- wdrożenie produkcyjne.
