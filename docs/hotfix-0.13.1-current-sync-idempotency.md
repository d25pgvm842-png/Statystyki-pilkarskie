# Hotfix 0.13.1 — idempotencja i rotacja bieżących aktualizacji

## Cel

Usunięcie ryzyka, że kolejne wywołania CRON-u przygotują wiele raportów dla tego samego sezonu i pominą pozostałe ligi.

## Zmiany

- trwały rejestr prób przygotowania bieżących danych,
- rotacja aktywnych sezonów według ostatniego wyboru,
- ponowne użycie istniejącego aktywnego raportu dla identycznego sezonu i zakresu,
- globalna blokada bazodanowa przygotowania raportów,
- automatyczne wygaśnięcie blokady po 20 minutach,
- oznaczanie przerwanych prób jako nieudanych,
- czytelny status HTTP 409 dla równoległego wywołania,
- test rotacji dwóch kolejnych uruchomień bez zatwierdzania pierwszego raportu.

## Poza zakresem

Hotfix nie przenosi jeszcze tworzenia drużyn, sędziów i mapowań do etapu zatwierdzania. Ten zakres pozostaje dla Sprintu 1.11A.
