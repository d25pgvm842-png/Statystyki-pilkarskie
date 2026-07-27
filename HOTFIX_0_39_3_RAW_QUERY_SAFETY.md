# Hotfix 0.39.3 — bramka bezpieczeństwa Raw SQL

## Cel

Awaria logowania pokazała, że zwykłe testy kompilacji nie wykrywają
nieobsługiwanego typu PostgreSQL `void` zwracanego przez surowe zapytanie.
Ten hotfix dodaje statyczną kontrolę wszystkich wywołań Raw SQL.

## Reguły

- zabronione są `$queryRawUnsafe` oraz `$executeRawUnsafe`,
- blokujące funkcje `pg_advisory_lock` i
  `pg_advisory_xact_lock` użyte przez `$queryRaw` muszą rzutować wynik
  do typu `text`,
- zwykłe parametryzowane zapytania, np. `SELECT 1`, pozostają dozwolone.

## Wdrożenie

Kontrola działa jako `npm run raw-query:check` i jest częścią
`npm run verify`, więc obowiązuje lokalnie, w instalatorach oraz na Vercelu.
Komenda `npm run raw-query:report` generuje pełny inwentarz w
`docs/RAW_QUERY_INVENTORY.md`.
