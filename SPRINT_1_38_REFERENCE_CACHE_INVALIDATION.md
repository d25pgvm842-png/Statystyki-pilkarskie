# Sprint 1.38 — natychmiastowe odswiezanie cache katalogow

Wersja: 0.40.0

## Diagnoza

Sprint 1.36 dodal pieciominutowy cache lig, sezonow, druzyn i sedziow.
Akcje administracyjne odswiezaly konkretne strony przez revalidatePath, ale nie
uniewaznialy wpisow unstable_cache. Po dodaniu lub zmianie katalogu inne strony
mogly przez maksymalnie piec minut nadal korzystac ze starej listy.

## Zakres

- wspolne, typowane tagi cache danych referencyjnych,
- updateTag po kazdej mutacji katalogu w panelu Konfiguracja,
- natychmiastowa widocznosc zmian zgodnie z read-your-writes,
- zmiana aktywnosci ligi odswieza rowniez sezony, bo cache sezonu zawiera stan ligi,
- zachowanie dotychczasowych revalidatePath,
- testy mapowania mutacji na tagi,
- brak zmian w meczach, statystykach i historii sezonow.

## Kryteria akceptacji

- wersja aplikacji wynosi 0.40.0,
- nowa liga jest od razu widoczna w filtrach,
- zmiana aktywnosci ligi od razu aktualizuje ligi i sezony,
- nowy lub aktywowany zespol jest od razu widoczny w filtrze Meczow,
- nowy lub aktywowany sedzia jest od razu widoczny w filtrze Meczow,
- zmiana aktywnego sezonu jest od razu widoczna w Analizie i Sedziach,
- typecheck, lint, testy i build koncza sie poprawnie.
