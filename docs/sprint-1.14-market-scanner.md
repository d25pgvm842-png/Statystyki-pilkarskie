# Sprint 1.14 — skaner rynkowy nadchodzących meczów

## Cel

Połączyć projekcje z Centrum analizy oraz wyniki Backtestera i automatycznie
wyłapywać nadchodzące spotkania spełniające jawne warunki modelu.

## Zakres

- nowa zakładka `Skaner`,
- wybór ligi, sezonu, rynku, linii i kierunku,
- zakres najbliższych 3, 7, 14, 30 lub 60 dni,
- historia 5, 10, 20 albo cała wcześniejsza historia,
- minimalna próba i minimalna przewaga projekcji,
- szybkie popularne linie,
- szybkie użycie prywatnych linii użytkownika,
- pełna projekcja gospodarza i gościa,
- backtest tych samych ustawień,
- historia trafności osobno dla kierunku oraz podobnego przedziału przewagi,
- cztery jawne statusy historyczne,
- diagnostyka odrzuconych spotkań,
- link do pełnej analizy meczu,
- eksport CSV.

## Statusy historyczne

`Wsparte historią`:
- minimum 20 sygnałów dla kierunku,
- minimum 8 sygnałów dla podobnej przewagi,
- minimum 55% trafności w obu grupach.

`Do obserwacji`:
- minimum 10 sygnałów dla kierunku,
- minimum 5 sygnałów dla podobnej przewagi,
- minimum 50% trafności w obu grupach.

`Słaba historia`:
- minimum 10 sygnałów dla kierunku,
- trafność kierunku poniżej 50%.

Pozostałe przypadki są oznaczane jako `niezweryfikowane`.

## Bezpieczeństwo analityczne

- skaner nie używa przyszłych meczów przy budowaniu projekcji,
- wymaga pełnej projekcji obu stron,
- `null` nigdy nie jest zamieniany na zero,
- status nie jest prognozą kursową ani gwarancją,
- moduł nie liczy wartości ani ROI bez historycznych i bieżących kursów.

## Brak migracji

Skaner działa dynamicznie na istniejących danych i nie zmienia schematu bazy.
