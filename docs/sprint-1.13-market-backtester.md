# Sprint 1.13 — backtester projekcji rynkowych

## Cel

Zweryfikować historycznie model projekcji stosowany w Centrum analizy meczu,
bez używania informacji, które nie były dostępne przed badanym spotkaniem.

## Metoda

Dla każdego zakończonego meczu w sezonie:

1. pobierana jest wyłącznie wcześniejsza historia gospodarza u siebie,
2. pobierana jest wyłącznie wcześniejsza historia gościa na wyjeździe,
3. projekcja korzysta z tego samego silnika co ekran Analiza,
4. wymagane są pełne projekcje obu stron i minimalna próba,
5. sygnał powstaje dopiero po przekroczeniu minimalnej odległości od linii,
6. wynik jest porównywany z rzeczywistą statystyką meczu.

## Funkcje

- wszystkie siedem rynków statystycznych,
- linia własna i szybkie popularne linie,
- over, under albo oba kierunki,
- lookback 5, 10, 20 lub cała wcześniejsza historia,
- minimalna próba,
- minimalna przewaga projekcji nad linią,
- trafność, pokrycie, średnia przewaga, MAE i bias,
- podział według przewagi, kierunku i miesiąca,
- lista sygnałów z linkiem do meczu,
- udział drużyn w sygnałach,
- diagnostyka odrzuconych meczów,
- szybkie użycie zapisanych linii użytkownika,
- eksport CSV.

## Ograniczenie

Backtest nie liczy ROI ani rentowności. Do tego potrzebne są historyczne kursy,
czas pobrania kursu i marża bukmachera. Trafność powyżej 50% nie jest sama
w sobie dowodem przewagi finansowej.

## Brak migracji

Moduł jest liczony dynamicznie z istniejących meczów i nie zmienia schematu bazy.
