# Sprint 1.11B — pochodzenie danych i konflikty wielu źródeł

## Zakres

- rejestr źródła osobno dla wyniku, sędziego i każdego pola statystycznego,
- migracja wsteczna obecnych danych,
- rozróżnienie źródła aktywnego, wspierającego, konfliktowego i pominiętego przez ręczną korektę,
- zachowanie istniejącej wartości przy konflikcie z innym źródłem,
- możliwość poprawienia wartości przez to samo źródło,
- prezentacja pochodzenia i konfliktów na stronie meczu.

## Zasady

- `null` nie nadpisuje wartości,
- ręczna korekta zawsze wygrywa,
- zgodne źródło wspiera dane,
- odmienne obce źródło tworzy konflikt i nie nadpisuje danych,
- to samo źródło może zaktualizować własną wartość,
- konflikty są jawne i pozostają do późniejszego rozstrzygnięcia.

## Świadome ograniczenie

Sprint obejmuje wynik, sędziego i 14 pól statystycznych. Termin, kolejka, status i identyfikatory drużyn nadal korzystają z dotychczasowych reguł synchronizacji.
