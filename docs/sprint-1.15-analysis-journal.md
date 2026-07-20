# Sprint 1.15 — Dziennik decyzji i watchlista

## Cel

Domknąć workflow od wykrycia kandydata w Skanerze do udokumentowania decyzji,
kursu, stawki oraz późniejszego rozliczenia.

## Funkcje

- nowa zakładka `Dziennik`,
- dodanie kandydata bezpośrednio ze Skanera,
- ochrona przed duplikatem tego samego meczu, rynku, linii i kierunku,
- ręczne dodawanie pozycji dla zaplanowanych meczów,
- statusy: obserwowana, zagrana, odrzucona, rozliczona i void,
- snapshot projekcji, przewagi, próby i kalibracji historycznej,
- bukmacher, kurs, kurs zamknięcia, stawka i komentarz,
- automatyczne rozliczenie zakończonych meczów,
- ręczne rozliczenie i korekta,
- trafność, obrót, profit, ROI i CLV,
- filtry po sezonie, rynku i statusie,
- eksport CSV,
- pełny audyt utworzenia, zmian i rozliczenia.

## Zasady

- wpis ze Skanera zapisuje wartości istniejące w momencie decyzji,
- późniejsza zmiana modelu nie nadpisuje historycznego snapshotu,
- `null` pozostaje brakiem danych,
- brak kursu przy trafionej pozycji nie tworzy fikcyjnego zysku,
- wynik finansowy nie jest liczony dla pozycji bez stawki,
- automatyczne rozliczenie dotyczy tylko sumy rynku i wymaga kompletu statystyk,
- ręczne rozliczenie pozostawia ślad w audycie,
- pozycje nie są fizycznie usuwane; mogą zostać odrzucone lub oznaczone jako void.

## Migracja

Sprint dodaje model `AnalysisPick` i cztery enumy. Migracja jest wykonywana przez
istniejący `prisma migrate deploy` podczas wdrożenia Vercel.
