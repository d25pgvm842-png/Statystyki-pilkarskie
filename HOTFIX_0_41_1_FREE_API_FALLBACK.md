# Hotfix 0.41.1 — fallback planu Free API-Football

## Przyczyna

Plan Free odrzuca zbiorczy parametr `fixtures?ids=...`, mimo że
pojedynczy parametr `fixtures?id=...` pozostaje dostępny.

## Poprawka

Zadanie rozpoczyna się w trybie `BATCH_IDS`. Po odpowiedzi
„Free plans do not have access to the Ids parameter” automatycznie:

1. zapisuje tryb `SINGLE_ID` w bazie,
2. pobiera bieżący mecz przez parametr `id`,
3. zachowuje dotychczasowy cursor i zadanie,
4. ogranicza tempo do jednego wywołania na 6,5 sekundy,
5. pokazuje tryb w interfejsie.

Nie trzeba kasować ani ponownie planować istniejących zadań.

## Ograniczenia

Plan Free ma 100 zapytań dziennie. Pełny sezon ligowy wymaga więc
kilku sesji lub dni. Postęp jest trwały i można go wznawiać.
