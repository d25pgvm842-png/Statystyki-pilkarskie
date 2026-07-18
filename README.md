# Staty piłkarskie

Aplikacja Next.js do zbierania, kontroli i analizy statystyk piłkarskich.

## Wymagania

- Node.js 22 lub nowszy
- PostgreSQL 16/17 albo Docker Desktop z WSL 2
- Git for Windows do aktualizacji repozytorium

## Najprostsze uruchomienie na Windows

Po zainstalowaniu Node.js 22 i Docker Desktop uruchom `URUCHOM_LOKALNIE.bat`.

Skrypt:
- uruchamia PostgreSQL,
- instaluje zależności,
- generuje Prisma Client,
- wdraża migracje,
- aktualizuje dane startowe,
- uruchamia aplikację pod `http://localhost:3000`.

Dane administratora po seedzie wynikają z `ADMIN_EMAIL` i `ADMIN_PASSWORD` w `.env`. Seed aktualizuje również hasło istniejącego administratora.

## Uruchomienie ręczne

```bash
cp .env.example .env
docker compose up -d
npm ci
npm run db:generate
npm run db:deploy
npm run db:seed
npm run dev
```

## Sprawdzenie jakości

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Te same kontrole wykonuje GitHub Actions po każdym pushu.

## Najważniejsze moduły

- `Dashboard` — stan bazy i jakość danych.
- `Mecze` — ręczne dodawanie i edycja pełnych statystyk home/away.
- `Porównanie` — projekcja gospodarza, gościa i sumy na podstawie splitów dom/wyjazd.
- `Drużyny` — średnie ogółem, u siebie i na wyjeździe.
- `Sędziowie` — kartki, faule i ostatnie mecze.
- `Import` — CSV, podgląd, walidacja i ochrona przed duplikatami.
- `Kontrola danych` — automatyczne wykrywanie braków i nielogicznych wartości.
- `Konfiguracja` — ligi, sezony, drużyny i sędziowie.

## Import CSV

Import odbywa się w dwóch krokach:

1. Wczytanie pliku i walidacja każdego wiersza.
2. Zatwierdzenie wyłącznie rekordów poprawnych.

Obsługiwany jest natywny szablon aplikacji oraz popularne nagłówki Football-Data, m.in. `HomeTeam`, `AwayTeam`, `FTHG`, `FTAG`, `HC`, `AC`, `HY`, `AY`, `HR`, `AR`, `HST`, `AST`, `HS`, `AS`, `HF`, `AF`.

Przykładowy plik znajduje się w `public/templates/matches-import.csv`.

## Struktura

- `docs/ARCHITECTURE.md` — architektura i decyzje.
- `docs/PLAN_REALIZACJI.md` — kolejne etapy.
- `prisma/schema.prisma` — model bazy.
- `src/lib/actions` — zapis danych i import.
- `src/lib/stats` — obliczenia.
- `src/app` — widoki.

## Wersja 0.4.0

- pełny ekran szczegółów meczu,
- historia zmian i ręcznych korekt,
- filtry po kolejce oraz zakresie dat,
- średnie dla aktualnego zestawu meczów,
- zakres ostatnich 5/10/20 spotkań lub cały sezon,
- rozbudowane statystyki sędziów,
- pokrycie linii over 3.5, 4.5 i 5.5 żółtych kartek,
- 8 testów automatycznych i build produkcyjny w CI.
