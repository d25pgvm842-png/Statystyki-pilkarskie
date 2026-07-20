# Hotfix 0.24.1 — płynny import bez przeładowań

## Problem

Dotychczasowy import wykonywał małą partię, następnie robił redirect i ponownie renderował całą stronę. Dla 170 spotkań oznaczało to dziesiątki pełnych przejść strony. Proces działał, ale był powolny, migotał i mógł wymagać ręcznego odświeżenia po przerwanym przejściu.

## Zmiana

- kolejne partie są uruchamiane z komponentu klienckiego przez Server Action,
- strona nie przeładowuje się pomiędzy partiami,
- liczby i pasek postępu aktualizują się po każdej partii,
- błędy przejściowe są automatycznie ponawiane maksymalnie dwa razy,
- użytkownik może zatrzymać proces po bieżącej partii i później go wznowić,
- po zakończeniu wykonywane jest jedno odświeżenie widoku,
- odświeżenie lub zamknięcie karty nie cofa już zapisanych partii,
- zachowano atomowe zatwierdzanie pojedynczych wierszy i ochronę przed duplikatami.

## Optymalizacja football-data.org

Dla istniejących mapowań źródła i drużyn importer korzysta z szybkiej ścieżki odczytu, zamiast przy każdym meczu ponownie wykonywać te same blokady i zapisy mapowań.

## Bezpieczeństwo

- bez migracji bazy,
- brak nadpisywania ręcznych korekt,
- historia importu pozostaje zachowana,
- `null` pozostaje brakiem danych,
- pojedynczy błędny wiersz nie cofa poprawnie zatwierdzonych spotkań.
