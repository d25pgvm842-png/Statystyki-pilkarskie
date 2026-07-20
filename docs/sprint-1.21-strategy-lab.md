# Sprint 1.21 — Laboratorium strategii

## Cel

Zamienić pojedyncze decyzje z Dziennika w zapisane, porównywalne reguły analityczne. Użytkownik może zbudować hipotezę, sprawdzić ją na historycznych snapshotach, zobaczyć ryzyko oraz ocenić zachowanie na późniejszej próbie walidacyjnej.

## Zakres

- nowa zakładka `Strategie`,
- tworzenie, edycja, duplikowanie, aktywowanie i wstrzymywanie strategii,
- trzy szablony startowe,
- filtry po lidze, sezonie, rynku, zakresie, OVER/UNDER, źródle wpisu, bukmacherze, wersji modelu, statusie rynku i statusie historii,
- progi linii, kursu, prawdopodobieństwa modelu, EV, przewagi, próby, pokrycia i historycznego backtestu,
- minimalny poziom wiarygodności modelu,
- porównanie strategii,
- trafność, kalibracja, Brier Score, EV, CLV, turnover, profit i ROI,
- maksymalne obsunięcie kapitału oraz najdłuższe serie wygranych i porażek,
- chronologiczny podział 70/30 na próbę roboczą i walidacyjną,
- stabilność miesięczna oraz segmenty według ligi, rynku, kierunku i wersji modelu,
- lista aktualnych otwartych pozycji spełniających regułę,
- pełny eksport CSV konfiguracji, metryk, segmentów i decyzji,
- audyt utworzenia, zmian, duplikowania oraz aktywacji strategii.

## Ochrona przed wyciekiem przyszłości

Reguły mogą wykorzystywać wyłącznie informacje zapisane w chwili decyzji. Wynik, rzeczywisty profit, CLV i kurs zamknięcia są używane tylko do oceny strategii, nigdy do wyboru pozycji.

Próba walidacyjna jest chronologiczna: najstarsze 70% rozliczonych sygnałów tworzy część roboczą, a najnowsze 30% służy do kontroli stabilności.

## Ważne ograniczenie

Laboratorium pracuje na wpisach zapisanych wcześniej w Dzienniku. Nie jest to pełny backtest wszystkich dostępnych meczów i może zawierać bias selekcji użytkownika. Komunikat o tym ograniczeniu jest stale widoczny w interfejsie.

## Bezpieczeństwo danych

- istniejące wpisy Dziennika nie są modyfikowane,
- snapshoty historyczne pozostają niezmienne,
- brak danych pozostaje `null`,
- brak kursu lub stawki wyklucza pozycję z wyniku finansowego,
- PUSH i VOID nie wchodzą do trafności ani Brier Score,
- strategii nie usuwa się fizycznie; można ją wstrzymać,
- migracja dodaje wyłącznie nową tabelę strategii oraz nowy typ encji audytu.

## Wersja

Po instalacji aplikacja ma wersję `0.25.0`.
