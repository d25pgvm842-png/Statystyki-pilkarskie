# Sprint 1.5B — finalizacja deploymentu Vercel

- `vercel-build` uruchamia walidację, generowanie klienta, migracje, bootstrap i build.
- Pierwszy administrator powstaje automatycznie z `ADMIN_EMAIL` i `ADMIN_PASSWORD`.
- Kolejne deploymenty nie nadpisują jego hasła.
- Bootstrap lig, sezonów i źródeł danych pozostaje idempotentny.
- Migracje preferują bezpośredni `POSTGRES_URL`, a runtime pozostaje na pulowanym `DATABASE_URL`.
