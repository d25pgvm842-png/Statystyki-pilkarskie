# Hotfix 0.39.2 — blokada logowania Prisma

## Potwierdzona przyczyna

Log produkcyjny zwrócił błąd Prisma P2010:

- surowe zapytanie zwracało kolumnę PostgreSQL typu `void`,
- adapter PrismaPg nie potrafił jej zdeserializować,
- digest błędu wynosił `2040452701`.

Ochrona logowania miała dwa takie zapytania: w rejestracji nieudanej
próby oraz po udanym uwierzytelnieniu.

## Poprawka

Wynik `pg_advisory_xact_lock` jest jawnie rzutowany do `text`.
Blokada transakcyjna nadal działa identycznie, ale Prisma otrzymuje typ,
który potrafi odczytać.

## Zakres bezpieczeństwa

- brak migracji,
- brak zmian w danych użytkowników,
- brak zmian limitów prób logowania,
- brak zmian sposobu haszowania adresu e-mail i IP,
- test regresji dla SQL i kluczy blokady.
