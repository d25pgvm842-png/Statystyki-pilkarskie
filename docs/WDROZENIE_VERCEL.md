# Wdrożenie online: Vercel + zarządzany PostgreSQL

## Docelowy układ

- aplikacja Next.js: Vercel,
- baza: Prisma Postgres z Vercel Marketplace albo inny zarządzany PostgreSQL,
- migracje: `prisma migrate deploy` podczas wdrożenia,
- inicjalizacja: jednorazowy `npm run db:bootstrap:production`,
- monitoring: `GET /api/health`.

## 1. Baza danych

W projekcie Vercel dodaj integrację Prisma Postgres. Integracja powinna ustawić `DATABASE_URL`. Można też użyć innego PostgreSQL, o ile connection string zaczyna się od `postgresql://` lub `postgres://` i obsługuje połączenia z Vercela.

Nie używaj w produkcji adresu `localhost`, nazwy hosta `postgres` ani lokalnego connection stringa z `docker-compose.yml`.

## 2. Zmienne środowiskowe

Ustaw w Vercel dla środowiska Production:

- `DATABASE_URL` — connection string bazy w chmurze,
- `AUTH_SECRET` — losowy sekret minimum 32 znaki,
- `ADMIN_EMAIL` — adres pierwszego administratora,
- `ADMIN_PASSWORD` — hasło minimum 12 znaków.

`AUTH_SECRET` nie może być wartością z `.env.example`, konfiguracji CI ani lokalnego developmentu. Build zatrzyma się automatycznie, gdy wykryje niebezpieczną konfigurację.

## 3. Import projektu

1. W Vercel wybierz **Add New Project**.
2. Zaimportuj repozytorium `d25pgvm842-png/Statystyki-pilkarskie`.
3. Framework powinien zostać wykryty jako Next.js.
4. Build Command pochodzi z `vercel.json`: `npm run vercel-build`.
5. Uruchom deployment.

Podczas builda projekt wykona kolejno:

1. walidację zmiennych,
2. generowanie Prisma Client,
3. bezpieczne zastosowanie zapisanych migracji,
4. produkcyjny build Next.js.

## 4. Pierwsze uruchomienie bazy

Po pierwszym udanym wdrożeniu wykonaj jednorazowo:

```bash
npm run db:bootstrap:production
```

Bootstrap tworzy lub aktualizuje:

- konto administratora,
- źródła danych ręczne, CSV i XLSX,
- sześć lig,
- sezon 2026/27.

Nie tworzy testowych meczów, drużyn ani sędziów.

## 5. Kontrola działania

Otwórz:

```text
https://ADRES-APLIKACJI/api/health
```

Prawidłowa odpowiedź ma status HTTP 200 oraz:

```json
{
  "status": "ok",
  "database": "ok"
}
```

HTTP 503 oznacza, że aplikacja działa, ale nie może połączyć się z bazą.

## 6. Bezpieczeństwo

- aplikacja wysyła nagłówki blokujące osadzanie w iframe i rozpoznawanie MIME,
- sesja produkcyjna używa ciasteczka `httpOnly`, `secure` i `sameSite=lax`,
- `robots.txt` blokuje indeksowanie całej prywatnej aplikacji,
- sekrety pozostają wyłącznie w panelu hostingu i nie trafiają do GitHuba.
