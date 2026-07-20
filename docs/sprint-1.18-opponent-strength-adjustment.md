# Sprint 1.18 — statystyki przeciw sile rywali

## Cel

Pokazać równolegle wynik surowy oraz wynik skorygowany jakością przeciwników.

## Model

- koszyk rywala jest liczony wyłącznie z meczów rozegranych przed analizowanym spotkaniem,
- TEAM_FOR drużyny korzysta z koszyka TEAM_AGAINST przeciwnika,
- TEAM_AGAINST drużyny korzysta z koszyka TEAM_FOR przeciwnika,
- MATCH_TOTAL korzysta z koszyka MATCH_TOTAL przeciwnika,
- oczekiwanie jest średnią ligową uzyskiwaną przeciw rywalom z tego samego koszyka i w tym samym miejscu,
- korekta to średnia różnica `wynik rzeczywisty - oczekiwanie`,
- wartość skorygowana to `średnia ligi + korekta`.

## Widoki

- profil drużyny: filtry rynku, zakresu i miejsca, podsumowanie oraz rozbicie na K1–K4,
- Centrum analizy meczu: surowe i skorygowane wartości gospodarza oraz gościa dla siedmiu rynków,
- eksport CSV profilu drużyny,
- eksport Centrum analizy rozszerzony o korektę siły rywali.

## Bezpieczeństwo danych

- brak migracji bazy,
- brak zapisu wartości pochodnych,
- brak wycieku przyszłych meczów,
- bieżący mecz nie wpływa na własny koszyk rywala,
- `null` pozostaje brakiem danych,
- ręczne korekty i historia sezonów pozostają bez zmian.
