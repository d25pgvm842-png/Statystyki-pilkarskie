# Sprint 1.20 — kalibracja modelu i jakości EV

## Cel

Sprawdzić, czy prawdopodobieństwa i EV zapisane w chwili decyzji odpowiadają późniejszym wynikom.

## Dodane

- kalibracja wyłącznie na snapshotach Dziennika,
- średnie prawdopodobieństwo modelu kontra faktyczna trafność,
- luka kalibracji w punktach procentowych,
- Brier Score dla rozliczonych wyników WIN/LOSS,
- koszyki prawdopodobieństwa: <50%, 50–<55%, 55–<60%, 60–<65%, 65%+,
- koszyki EV: <0%, 0–<2%, 2–<5%, 5–<10%, 10%+,
- profit, obrót i ROI w segmentach EV,
- segmenty według ligi, rynku, OVER/UNDER, wersji modelu i statusu decyzji,
- ostrzeżenie o małej próbie poniżej 10 rozliczonych obserwacji,
- osobny eksport CSV kalibracji.

## Zasady

- późniejsza zmiana modelu nie zmienia historycznego snapshotu,
- PUSH i VOID nie wchodzą do trafności ani Brier Score,
- brak kursu lub stawki wyklucza pozycję z ROI, nie tworzy zera,
- stare wpisy bez modelProbability/expectedValue/modelVersion pozostają poprawne,
- `null` pozostaje brakiem danych,
- Brier Score ma zakres 0–1; niższy wynik jest lepszy,
- luka kalibracji = faktyczna trafność minus średnie prawdopodobieństwo modelu.

## Brak migracji

Sprint wykorzystuje pola snapshotu dodane w Sprint 1.19. Nie zmienia schematu bazy.

## Poprawka niezawodności importu

W tej paczce Sprintu 1.20 uwzględniono również poprawkę procesu zatwierdzania importów football-data.org:

- partia importu została zmniejszona z 20 do 5 wierszy, aby ciężkie transakcje zewnętrzne nie przekraczały czasu żądania Vercela,
- przycisk pokazuje stan oczekiwania natychmiast po kliknięciu,
- automatyczne przetwarzanie uruchamia kolejną partię po każdej zmianie liczby pozostałych wierszy,
- odświeżenie strony nie uszkadza importu; proces można bezpiecznie wznowić.
