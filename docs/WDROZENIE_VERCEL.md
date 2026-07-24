# Wdrożenie online: Vercel + zarządzany PostgreSQL

## Docelowy układ

- aplikacja Next.js: Vercel,
- baza: Prisma Postgres z Vercel Marketplace albo inny zarządzany PostgreSQL,
- migracje: `prisma migrate deploy` dopiero po przejściu bramki jakości,
- inicjalizacja: automatyczny, idempotentny bootstrap po migracjach,
- liveness: `GET /api/health`,
- readiness: `GET /api/ready`.

## 1. Baza danych

W projekcie Vercel dodaj integrację Prisma Postgres. Integracja powinna ustawić `DATABASE_URL`. Można też użyć innego PostgreSQL, o ile connection string zaczyna się od `postgresql://` lub `postgres://` i obsługuje połączenia z Vercela.

Nie używaj w produkcji adresu `localhost`, nazwy hosta `postgres` ani lokalnego connection stringa z `docker-compose.yml`.

## 2. Zmienne środowiskowe

Ustaw w Vercel dla środowiska Production:

- `DATABASE_URL` — połączenie aplikacji przez pulę,
- `POSTGRES_URL` — bezpośrednie połączenie używane przez migracje, jeśli integracja je udostępnia,
- `AUTH_SECRET` — losowy sekret minimum 32 znaki,
- `ADMIN_EMAIL` — adres pierwszego administratora,
- `ADMIN_PASSWORD` — hasło minimum 12 znaków.

`AUTH_SECRET` nie może być wartością z `.env.example`, konfiguracji CI ani lokalnego developmentu. Bramka wydania zatrzyma wdrożenie, gdy wykryje niebezpieczną konfigurację.

## 3. Import projektu

1. W Vercel wybierz **Add New Project**.
2. Zaimportuj repozytorium `d25pgvm842-png/Statystyki-pilkarskie`.
3. Framework powinien zostać wykryty jako Next.js.
4. Build Command pochodzi z `vercel.json`: `npm run vercel-build`.
5. Uruchom deployment.

## 4. Kolejność wdrożenia

`npm run vercel-build` wykonuje:

1. walidację zmiennych produkcyjnych,
2. generowanie Prisma Client,
3. typecheck,
4. lint,
5. testy jednostkowe,
6. produkcyjny build Next.js,
7. zastosowanie zapisanych migracji,
8. idempotentny bootstrap danych produkcyjnych.

Migracje nie są wykonywane, gdy kod, testy, lint, typecheck albo build nie przejdą.

## 5. Kontrola działania

### Liveness

`GET /api/health` sprawdza, czy działa proces aplikacji. Nie łączy się z bazą.

Prawidłowa odpowiedź ma HTTP 200 i zawiera:

```json
{
  "status": "ok",
  "application": "Staty piłkarskie",
  "version": "0.33.0",
  "environment": "production",
  "commit": "12-znakowy-sha",
  "timestamp": "ISO-8601"
}
```

### Readiness

`GET /api/ready` sprawdza aplikację oraz połączenie z PostgreSQL.

Przy poprawnym działaniu zwraca HTTP 200:

```json
{
  "status": "ok",
  "database": "ok"
}
```

Przy awarii bazy zwraca HTTP 503:

```json
{
  "status": "degraded",
  "database": "error"
}
```

Odpowiedzi nie ujawniają adresu bazy ani treści błędu.

## 6. Automatyczna kontrola wydania

Workflow `Release health` uruchamia się po udanym wdrożeniu produkcyjnym. Porównuje:

- wersję endpointu z `package.json`,
- skrócony SHA z wdrożonym commitem,
- środowisko `production`,
- odpowiedzi GET i HEAD,
- gotowość połączenia z bazą.

Niepoprawne wdrożenie otrzymuje czerwony check w GitHub Actions.

## 7. Bezpieczeństwo

- aplikacja wysyła nagłówki blokujące osadzanie w iframe i rozpoznawanie MIME,
- sesja produkcyjna używa ciasteczka `httpOnly`, `secure` i `sameSite=lax`,
- `robots.txt` blokuje indeksowanie całej prywatnej aplikacji,
- sekrety pozostają wyłącznie w panelu hostingu i nie trafiają do GitHuba.
