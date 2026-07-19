# Hotfix 0.15.3 — wiarygodność projekcji i prób sędziego

## Problem 1: projekcja jednostronna wyglądała jak pełna

Dotychczas średnia projekcji ignorowała brakującą składową. Gdy dostępna była
tylko produkcja jednej drużyny albo tylko wartość dopuszczana przez rywala,
interfejs nadal pokazywał liczbę bez jasnego ostrzeżenia.

## Poprawka

- każda prognoza strony ma jakość: pełna, jednostronna lub brak danych,
- prognoza jednostronna pozostaje widoczna jako wskaźnik orientacyjny,
- prognoza sumy powstaje wyłącznie wtedy, gdy obie prognozy stron są pełne,
- interfejs pokazuje próbę każdej składowej osobno,
- rynki jednostronne trafiają do ostrzeżenia o ograniczonej jakości danych,
- eksport CSV zawiera status jakości projekcji.

## Problem 2: profil sędziego pokazywał jedną mylącą próbę

Liczba wcześniejszych meczów obejmowała wszystkie spotkania sędziego,
natomiast średnie kartek, fauli i rożnych mogły bazować na różnych zbiorach.

## Poprawka

- żółte, czerwone, wszystkie kartki, faule i rożne mają własną próbę,
- średnia wszystkich kartek jest liczona tylko z meczów posiadających komplet
  żółtych i czerwonych kartek obu drużyn,
- interfejs i eksport CSV pokazują właściwe `n` przy każdej metryce.

Hotfix nie zmienia schematu bazy danych.
