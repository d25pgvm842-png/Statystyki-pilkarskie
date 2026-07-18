# Staty piłkarskie

Aplikacja Next.js do zbierania i analizowania statystyk piłkarskich.

## Wymagania

- Node.js 22 lub nowszy
- PostgreSQL 16/17 albo Docker

## Uruchomienie

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Aplikacja będzie dostępna pod `http://localhost:3000`.

Domyślne dane logowania po seedzie wynikają z `ADMIN_EMAIL` i `ADMIN_PASSWORD` w pliku `.env`.

## Sprawdzenie

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Struktura

- `docs/ARCHITECTURE.md` — architektura i decyzje.
- `docs/ROADMAP.md` — kolejne etapy.
- `prisma/schema.prisma` — model bazy.
- `src/lib/actions` — zapis danych.
- `src/lib/stats` — obliczenia.
- `src/app` — widoki.

## Ważne

Dane seedujące służą tylko do lokalnego uruchomienia i demonstracji. W produkcji zespoły, sędziowie i mecze będą pochodziły z importu albo adaptera API.
