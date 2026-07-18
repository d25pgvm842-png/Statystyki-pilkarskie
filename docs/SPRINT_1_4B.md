# Sprint 1.4B — import produkcyjny i pełny audyt

Zakres wersji 0.5.0:

- bezpieczne, wznawialne zatwierdzanie importu CSV,
- ponowne sprawdzanie duplikatów dokładnie w chwili zapisu,
- szczegółowe przyczyny duplikatów z odnośnikiem do istniejącego meczu,
- możliwość ręcznego pominięcia i przywrócenia poprawnego wiersza,
- anulowanie importu bez usuwania historii,
- raport CSV wszystkich wierszy, statusów i błędów,
- powiązanie wiersza raportu z utworzonym meczem,
- pełny wpis audytowy obejmujący dane meczu i 14 pól statystycznych,
- identyfikator źródłowy `csv:<batchId>:<rowId>` zapisany przy meczu,
- odporność na duplikat powstały równolegle podczas zatwierdzania,
- filtry raportu po statusie: poprawny, zaimportowany, duplikat, błąd i pominięty.

Sprint nie zmienia schematu PostgreSQL i nie wymaga migracji.
