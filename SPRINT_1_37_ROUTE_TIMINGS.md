# Sprint 1.37 — pomiary czasu głównych tras

Wersja: 0.39.0

## Diagnoza

Najcięższe moduły Analizy, Kontroli danych i Sędziów mają już pomiary operacji
serwerowych. Brakowało ich na dwóch najczęściej używanych wejściach:
Dashboardzie i liście Meczów.

W sprawdzonych głównych trasach nie znaleziono pełnego, nieograniczonego skanu
historii. Dashboard ogranicza mecze datą i limitem 8, a lista Meczów jest
paginowana po 50 rekordów. Odczyty Analizy i Sędziów są ograniczone wybranym
sezonem.

## Zakres

- pomiar głównego zestawu danych Dashboardu,
- osobny pomiar awaryjnego pobrania najbliższych meczów,
- pomiar liczby wyników i filtrów strony Meczów,
- pomiar pobrania bieżącej strony 50 meczów,
- wykorzystanie istniejącego formatu logu slow_server_operation,
- brak zmian w danych, filtrach, cache i logice bukmacherskiej.

## Kryteria akceptacji

- wersja aplikacji wynosi 0.39.0,
- wolne odczyty Dashboardu są widoczne w logach Vercela,
- wolne odczyty listy Meczów są widoczne w logach Vercela,
- Dashboard nadal pokazuje maksymalnie 8 meczów,
- lista Meczów nadal używa paginacji po 50,
- typecheck, lint, testy i build kończą się poprawnie.
