# Sprint 1.35.1 — Data Quality Batching

Wersja: 0.37.0

## Korekta instalatora

Pierwszy instalator Sprintu 1.35 szukał strony po nieaktualnym
tekście nagłówka. Aktualna strona znajduje się pod stałą ścieżką:

`src/app/(dashboard)/data-quality/page.tsx`

Ta paczka modyfikuje dokładnie ten plik.

## Zakres

- zachowuje istniejące filtry ligi, sezonu, źródła, poziomu i typu,
- zachowuje profile źródeł i tabelę pokrycia statystyk,
- pobiera mecze partiami po 300,
- ogranicza skan całej historii do 10 000 najnowszych meczów,
- paginuje problemy po 50,
- pokazuje jawne ostrzeżenie po osiągnięciu limitu,
- mierzy czas ciężkiego loadera.
