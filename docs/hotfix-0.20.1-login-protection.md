# Hotfix 0.20.1 — ochrona logowania

## Zakres

- trwały limit nieudanych prób w PostgreSQL,
- oddzielna kontrola adresu e-mail i adresu IP,
- blokada po 5 nieudanych próbach w ciągu 15 minut,
- blokada trwa 15 minut,
- pomyślne logowanie zeruje liczniki,
- audyt sukcesów, porażek i uruchomionych blokad,
- e-mail i IP są przechowywane wyłącznie jako HMAC-SHA256 z `AUTH_SECRET`,
- jednakowy komunikat dla błędnego użytkownika i błędnego hasła,
- porównanie z hashem zastępczym ogranicza możliwość sprawdzania istnienia konta czasem odpowiedzi.

## Bezpieczeństwo i dane

- stan nie znajduje się w pamięci procesu, więc działa między instancjami Vercela,
- blokady są aktualizowane transakcyjnie,
- blokady doradcze PostgreSQL chronią przed równoczesnymi próbami,
- nie zmieniono kont, haseł ani sesji,
- migracja dodaje wyłącznie dwie nowe tabele.
