# Sprint 1.8C — centrum pokrycia i jakości źródeł

## Cel

Oddzielić prawdziwe braki danych od pól, których konkretne źródło nie dostarcza regularnie.

## Zakres

- automatyczne profilowanie pokrycia dla każdej kombinacji liga–sezon–źródło,
- osobna ocena dostępności sędziów i każdej kategorii statystycznej,
- brak seryjnych ostrzeżeń, gdy źródło nie zapewnia danej wartości,
- zachowanie ostrzeżeń dla pojedynczych braków w źródłach o wysokim pokryciu,
- tabela procentowego pokrycia źródeł,
- filtry kontroli danych po lidze, sezonie, źródle, poziomie i typie problemu,
- poprawne liczenie kompletności i brakujących sędziów na Dashboardzie.

## Zasada rozpoznawania możliwości źródła

Dla próby co najmniej 10 zakończonych meczów pole jest uznawane za regularnie obsługiwane, gdy występuje w co najmniej połowie rekordów danego źródła i sezonu. Mniejsze próby korzystają z bezpiecznych ustawień domyślnych dostawcy.

Ograniczenie źródła jest widoczne w tabeli pokrycia, ale nie tworzy setek identycznych ostrzeżeń dla pojedynczych meczów.
