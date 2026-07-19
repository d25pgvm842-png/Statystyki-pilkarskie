# Hotfix 0.15.2 — mapowanie i scalanie drużyn

## Problem

football-data.org używa nazw takich jak `FC Bayern München`, `1. FSV Mainz 05`
czy `1. FC Union Berlin`, podczas gdy istniejące dane mogą zawierać nazwy
`Bayern Munich`, `Mainz` i `Union Berlin`. Dotychczasowe dopasowanie nie używało
pełnego zestawu: nazwa, krótka nazwa, slug i historia ligi.

## Poprawka

- wspólny resolver tożsamości drużyn,
- normalizacja oznaczeń klubowych i znanych aliasów,
- wykorzystanie krótkiej nazwy oraz historii sezonów tej samej ligi,
- automatyczne połączenie tylko przy jednoznacznym wyniku,
- zatrzymanie wiersza przy niejednoznaczności,
- ponowne sprawdzenie drużyny wewnątrz transakcji zatwierdzającej,
- panel `Automatyzacja → Kontrola duplikatów drużyn`,
- atomowe przenoszenie meczów, sezonów i mapowań,
- blokada scalenia przy kolizji meczu lub źródła,
- wpis audytowy `MERGE_DUPLICATE_TEAM`.

## Procedura dla przerwanego importu Bundesligi

1. Nie wznawiaj raportu z pozostałymi 106 meczami.
2. Wdróż Hotfix 0.15.2.
3. Pobierz kopię danych.
4. Otwórz kontrolę duplikatów dla Bundesligi 2026/27.
5. Scal potwierdzone pary do starszych drużyn z historią.
6. Sprawdź liczbę drużyn.
7. Dopiero potem wznów import.
