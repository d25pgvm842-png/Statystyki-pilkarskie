# Sprint 1.8B — darmowe źródła danych

## Cel

Ograniczyć użycie API-Football i oprzeć standardowe zasilanie aplikacji na darmowych źródłach.

## Źródła

- football-data.org — bieżące terminarze i wyniki pięciu największych lig; klucz `FOOTBALL_DATA_ORG_KEY` jest opcjonalny, ale zalecany.
- OpenFootball — darmowy fallback bez klucza dla terminarzy i wyników.
- Football-Data.co.uk — wyniki historyczne i dostępne statystyki meczowe z plików CSV.
- API-Football — wyłącznie awaryjne uzupełnienie.

## Zasady zapisu

- Każde pobranie tworzy raport importu do weryfikacji.
- Dane nie trafiają do tabeli meczów bez ręcznego zatwierdzenia.
- Istniejące mecze są rozpoznawane po identyfikatorze źródła albo po drużynach i dniu meczu.
- Dane z kolejnego źródła mogą uzupełnić istniejący mecz bez tworzenia duplikatu.
- Ręczne korekty zapisane jako `DataOverride` pozostają zablokowane przed nadpisaniem.

## Zakres

- Premier League, LaLiga, Serie A, Bundesliga i Ligue 1: bieżące dane z football-data.org lub OpenFootball oraz historia z Football-Data.co.uk.
- Ekstraklasa: darmowy plik polski Football-Data.co.uk, gdy zawiera wybrany sezon; API-Football pozostaje źródłem awaryjnym.
