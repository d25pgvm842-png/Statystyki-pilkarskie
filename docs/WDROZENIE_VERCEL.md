# Wdrożenie na Vercel

## 1. Baza PostgreSQL

Utwórz bazę PostgreSQL w panelu Vercel Storage lub Neon. Skopiuj pełny connection string i ustaw go jako `DATABASE_URL`.

## 2. Projekt Vercel

1. Zaimportuj repozytorium `d25pgvm842-png/Statystyki-pilkarskie`.
2. Framework: Next.js.
3. Build Command zostaw z `vercel.json`: `npm run vercel-build`.
4. Dodaj zmienne dla Production, Preview i Development:
   - `DATABASE_URL`
   - `AUTH_SECRET` — losowy sekret minimum 32 znaki
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
5. Uruchom pierwsze wdrożenie.

## 3. Pierwszy administrator

Seed nie jest wykonywany automatycznie przy każdym buildzie, żeby deployment nie zmieniał danych produkcyjnych. Po utworzeniu bazy wykonaj jednorazowo:

```bash
npm run db:seed:production
```

Można to wykonać lokalnie, używając produkcyjnego `DATABASE_URL`, albo przez jednorazowe środowisko terminalowe.

## 4. Migracje

Każdy build produkcyjny uruchamia `prisma migrate deploy`. Migracje muszą być wcześniej zapisane w katalogu `prisma/migrations`.
