# Sprint 1.41 — historyczne zasilanie API-Football

Wersja: 0.41.0

## Problem

Dotychczasowy importer API-Football był przygotowany do bieżących zakresów:
maksymalnie 31 dni oraz 20 spotkań w jednej paczce. Nie nadawał się do
zbudowania wielosezonowej bazy treningowej dla modeli statystycznych.

## Rozwiązanie

Moduł „Historia API” tworzy trwałe zadanie dla pary liga–sezon. Lista
zakończonych meczów jest zapisywana w PostgreSQL, a szczegóły są pobierane
paczkami do 20 fixture IDs. Każda paczka jest następnie zatwierdzana po pięć
wierszy istniejącym atomowym importerem.

Dzięki temu:

- zamknięcie przeglądarki nie usuwa postępu,
- limit lub błąd API nie wymusza rozpoczęcia od początku,
- duplikaty są wykrywane po identyfikatorze dostawcy i dacie meczu,
- ręczne korekty pozostają chronione,
- każdy zapis nadal tworzy audyt i obserwacje pochodzenia pól.

## Zakres startowy

Interfejs domyślnie proponuje sześć lig oraz sezony:

- 2023/24,
- 2024/25,
- 2025/26.

Dostępność starszych sezonów zależy od planu API-Football.

## Raport jakości

Dla każdego sezonu liczona jest kompletność:

- rożnych,
- kartek,
- strzałów i strzałów celnych,
- fauli,
- spalonych.

Brak danych pozostaje wartością null i nie jest zamieniany na zero.

## Następny etap

Po zasileniu bazy należy przebudować źródło danych Warsztatu na model
wielosezonowy z malejącą wagą starszych sezonów i oddzielną obsługą
beniaminków.
