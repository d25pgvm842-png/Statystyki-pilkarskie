# Sprint 1.11A — czysty i atomowy import zewnętrzny

## Cel

Usunięcie ryzyka, że samo przygotowanie raportu tworzy encje słownikowe oraz że awaria zatwierdzania pozostawia osierocone drużyny, sędziów lub mapowania.

## Przygotowanie raportu

Przygotowanie może zapisać wyłącznie `ImportBatch` i `ImportRow`. Istniejące encje są tylko odczytywane. Nowe drużyny, sędziowie, przypisania sezonowe, źródła i mapowania są opisane jako kandydaci w `rawData`.

## Zatwierdzanie

Każdy wiersz zewnętrzny jest zatwierdzany w jednej transakcji PostgreSQL. Transakcja obejmuje:

- źródło danych,
- mapowanie ligi,
- drużyny i mapowania drużyn,
- przypisania drużyn do sezonu,
- sędziego i przypisanie sezonowe,
- ponowny odczyt meczu i `DataOverride`,
- utworzenie lub aktualizację meczu,
- statystyki,
- audyt,
- zmianę statusu wiersza.

Błąd cofa cały wiersz.

## Współbieżność

- wiersz importu otrzymuje transakcyjny advisory lock,
- encje źródłowe otrzymują stabilne blokady według dostawcy i identyfikatora,
- istniejący mecz jest blokowany `FOR UPDATE`,
- po uzyskaniu blokady mecz i ręczne korekty są odczytywane ponownie.

## Kompatybilność

- import CSV nadal działa partiami po 20,
- stare raporty zewnętrzne posiadające gotowe identyfikatory mogą zostać zatwierdzone,
- `null` pozostaje brakiem danych,
- status `FINISHED` i ręczne korekty nadal są chronione.

## Poza zakresem

Pochodzenie wartości per pole i rozstrzyganie konfliktów wielu źródeł pozostaje zakresem Sprintu 1.11B.
