# Hotfix 0.41.4 — ręczne mapowanie drużyny API

## Przyczyna

Importer i ekran duplikatów rozwiązują dwa różne problemy:

- importer wykrywa, że nazwa zewnętrzna pasuje do kilku istniejących klubów,
- ekran duplikatów sugeruje scalenie dwóch rekordów klubowych tylko wtedy,
  gdy spełniają dodatkowe kryteria historii i daty utworzenia.

Dlatego możliwy był stan: importer żąda decyzji, ale ekran duplikatów jest pusty.

## Poprawka

- zadanie przechodzi w PAUSED po nierozstrzygniętym mapowaniu,
- ekran pokazuje kandydatów zapisanych w błędnym wierszu,
- administrator wybiera właściwą drużynę,
- system zapisuje trwałe mapowanie zewnętrznego ID,
- decyzja jest walidowana i audytowana,
- żaden klub nie jest automatycznie scalany ani usuwany,
- ponowne wznowienie odzyskuje wiersz bez wywołania API.
