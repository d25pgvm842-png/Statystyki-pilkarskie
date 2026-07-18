# Plan realizacji produktu

## Etap 1 — fundament i uruchomienie

- [x] poprawna struktura repozytorium
- [x] PostgreSQL i migracje Prisma
- [x] logowanie administratora
- [x] automatyczna konfiguracja lokalna
- [x] CI: typecheck, lint, testy i build

## Etap 2 — kompletne zarządzanie danymi

- [x] ligi i sezony
- [x] drużyny i składy ligowe
- [x] sędziowie
- [x] mecze i wszystkie statystyki home/away
- [x] walidacja i ochrona przed duplikatami
- [x] historia zmian oraz ręczne nadpisania
- [ ] zbiorcza edycja rekordów

## Etap 3 — import

- [x] CSV
- [x] podgląd przed importem
- [x] rozpoznawanie popularnych nagłówków Football-Data
- [x] wykrywanie błędów, braków i duplikatów
- [x] raport po imporcie
- [ ] XLSX
- [ ] ręczne mapowanie niestandardowych kolumn
- [ ] adaptery API niezależne od dostawcy

## Etap 4 — analityka bukmacherska

- [x] średnie ogółem, dom, wyjazd
- [x] forma z ostatnich 5/10/20 spotkań
- [x] statystyki for/against
- [x] podstawowe porównanie drużyn przed meczem
- [x] profile sędziów
- [ ] linie over/under dla każdej kategorii
- [ ] procent trafień linii
- [ ] własne linie użytkownika
- [ ] zaawansowane H2H i filtry rywala

## Etap 5 — produkt końcowy

- [ ] eksport CSV/XLSX
- [ ] wdrożenie online
- [ ] PWA i dopracowany mobile UX
- [ ] role użytkowników i konta komercyjne
- [ ] monitoring błędów i kopie bazy
- [ ] testy integracyjne i end-to-end
- [ ] płatności i plany subskrypcyjne
