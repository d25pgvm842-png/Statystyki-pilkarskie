# Inwentarz surowych zapytań SQL

Raport generowany automatycznie przez `npm run raw-query:report`.
Pliki testowe i wygenerowany Prisma Client są pomijane.

Łączna liczba wywołań: **10**.

| Plik | Linia | API | SQL |
|---|---:|---|---|
| `src/app/api/ready/route.ts` | 14 | `$queryRaw` | `SELECT 1` |
| `src/lib/actions/team-duplicate-actions.ts` | 30 | `$queryRaw` | `SELECT pg_advisory_xact_lock(hashtext(?))::text AS "lock"` |
| `src/lib/external-mappings.ts` | 28 | `$queryRaw` | `SELECT * FROM "ExternalMapping" WHERE "providerCode" = ? AND (?::text IS NULL OR "entityType"::text = ?) AND (?::boolean IS NULL OR "acti...` |
| `src/lib/external-mappings.ts` | 48 | `$queryRaw` | `SELECT * FROM "ExternalMapping" WHERE "providerCode" = ? AND "entityType"::text = ? AND (?::text IS NULL OR "externalId" = ?) AND (?::tex...` |
| `src/lib/external-mappings.ts` | 77 | `$executeRaw` | `DELETE FROM "ExternalMapping" WHERE "providerCode" = ? AND "entityType"::text = ? AND ("externalId" = ? OR "internalId" = ?)` |
| `src/lib/external-mappings.ts` | 84 | `$executeRaw` | `INSERT INTO "ExternalMapping" ( "id", "providerCode", "entityType", "internalId", "externalId", "externalName", "metadata", "active", "cr...` |
| `src/lib/imports/external-commit.ts` | 79 | `$queryRaw` | `SELECT pg_advisory_xact_lock(hashtext(?))::text AS "lock"` |
| `src/lib/imports/external-commit.ts` | 391 | `$queryRaw` | `SELECT "id" FROM "Match" WHERE "id" = ? FOR UPDATE` |
| `src/lib/security/login-protection-lock.ts` | 12 | `$queryRaw` | `SELECT pg_advisory_xact_lock(hashtextextended(?, 0))::text AS "lock"` |
| `src/lib/transaction-locks.ts` | 17 | `$queryRaw` | `SELECT pg_advisory_xact_lock(hashtextextended(?, 0))::text AS "lock"` |

## Zasady

- `$queryRawUnsafe` i `$executeRawUnsafe` są zabronione.
- `pg_advisory_lock` i `pg_advisory_xact_lock` użyte przez `$queryRaw` muszą rzutować wynik do `text`.
- kontrola jest częścią `npm run verify` oraz wdrożenia Vercela.
