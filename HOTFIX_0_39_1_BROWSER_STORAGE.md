# Hotfix 0.39.1 — odporność pamięci przeglądarki

## Diagnoza

Endpointy liveness i readiness potwierdziły działający proces aplikacji,
właściwy commit oraz poprawne połączenie z PostgreSQL. Widok wpadał natomiast
w globalny boundary aplikacji.

Root layout uruchamia ThemeProvider dla każdej strony. Provider odczytywał
localStorage i matchMedia bez obsługi wyjątków. AppShell oraz ThemeToggle
również wykonywały niezabezpieczone operacje localStorage. SecurityError,
blokada danych witryny albo niedostępne API przeglądarki mogły więc wyłączyć
cały interfejs.

## Zakres

- bezpieczny odczyt localStorage,
- bezpieczny zapis localStorage,
- bezpieczny odczyt systemowej preferencji motywu,
- fallback zamiast globalnego błędu,
- zabezpieczenie ThemeProvider, ThemeToggle i stanu panelu bocznego,
- testy wyjątków pamięci przeglądarki,
- brak zmian w bazie danych.
