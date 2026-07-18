# Plan realizacji produktu

## Etap 1 — fundament i uruchomienie

- poprawna struktura repozytorium
- PostgreSQL i migracje Prisma
- logowanie administratora
- automatyczna konfiguracja lokalna
- bezpieczny build Vercel
- CI: typecheck, lint, testy

## Etap 2 — kompletne zarządzanie danymi

- ligi i sezony
- drużyny i składy ligowe
- sędziowie
- mecze i wszystkie statystyki home/away
- walidacja i ochrona przed duplikatami
- historia zmian oraz ręczne nadpisania

## Etap 3 — import

- CSV
- XLSX
- podgląd przed importem
- mapowanie kolumn
- wykrywanie błędów, braków i duplikatów
- raport po imporcie
- adaptery API niezależne od konkretnego dostawcy

## Etap 4 — analityka bukmacherska

- średnie ogółem, dom, wyjazd
- forma z ostatnich 5/10 spotkań
- statystyki for/against
- linie over/under dla każdej kategorii
- porównanie drużyn przed meczem
- profile sędziów
- własne linie użytkownika

## Etap 5 — produkt końcowy

- eksport CSV/XLSX
- PWA i dopracowany mobile UX
- role użytkowników
- monitoring błędów i kopie bazy
- testy integracyjne i end-to-end
- wydajne zapytania oraz indeksy
