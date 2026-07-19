# Hotfix 0.15.1 — czysty podgląd nowego sezonu historycznego

## Problem

Historyczne pobieranie wywoływało `season.upsert()` przed utworzeniem raportu.
Samo otwarcie podglądu mogło więc utworzyć sezon albo zmienić jego daty,
mimo że użytkownik nie zatwierdził importu.

## Poprawka

- istniejący sezon jest tylko odczytywany,
- brakujący sezon jest przechowywany jako kandydat w `ImportRow.rawData`,
- sezon powstaje dopiero w transakcji zatwierdzającej pierwszy poprawny wiersz,
- anulowanie raportu przed zastosowaniem nie tworzy sezonu,
- błąd wiersza wycofuje również utworzenie sezonu,
- równoległe zatwierdzenia korzystają z blokady transakcyjnej i `upsert`.

## Test akceptacyjny

1. Wybierz historyczny sezon, którego nie ma w aplikacji.
2. Kliknij pobranie do weryfikacji.
3. Nie klikaj „Zastosuj”.
4. Sprawdź listę sezonów — nowy sezon nie może się pojawić.
5. Wróć do raportu i kliknij „Zastosuj”.
6. Po pierwszym poprawnym wierszu sezon powinien istnieć.
