# Sprint 1.10 — bezpieczne aktualizacje bieżących danych

## Zakres

- centrum aktualizacji wszystkich aktywnych lig,
- rzeczywisty postęp przygotowywania raportów liga po lidze,
- osobny raport importu dla każdego sezonu,
- endpoint administratora do pojedynczej aktualizacji,
- opcjonalny endpoint CRON zabezpieczony zmienną `CRON_SECRET`,
- wybór przez CRON najdawniej aktualizowanego aktywnego sezonu,
- ochrona istniejących wyników, sędziów i statystyk przed nadpisaniem pustymi wartościami,
- blokada cofnięcia meczu ze statusu `FINISHED` do `LIVE` lub `SCHEDULED`.

## Zasada bezpieczeństwa

Automatyczna aktualizacja wyłącznie przygotowuje raporty. Dane trafiają do tabeli meczów dopiero po zatwierdzeniu importu.

## CRON

Endpoint: `/api/cron/current-data`

Wymaga nagłówka `Authorization: Bearer <CRON_SECRET>` albo `x-cron-secret: <CRON_SECRET>`.
Każde wywołanie obsługuje jeden najdawniej aktualizowany aktywny sezon, co ogranicza ryzyko przekroczenia czasu wykonania.
