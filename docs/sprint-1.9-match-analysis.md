# Sprint 1.9 — Centrum analizy meczu

## Zakres

- nowy ekran `/analysis` łączący formę, splity dom/wyjazd i projekcje statystyczne,
- popularne linie over/under dla wszystkich obsługiwanych kategorii,
- ostatnie H2H,
- profil sędziego z wcześniejszych spotkań,
- własne linie użytkownika bez opuszczania analizy,
- notatka analityczna zapisywana przy meczu i rejestrowana w audycie,
- eksport kompletnej analizy do CSV,
- ostrzeżenia o małej próbie i brakujących danych,
- osobna, prywatna notatka analityczna użytkownika zapisywana w dedykowanej tabeli.

## Model projekcji

Prognoza gospodarza jest średnią z jego produkcji u siebie oraz wartości oddawanych przez gościa na wyjeździe. Prognoza gościa działa analogicznie. Jest to wskaźnik analityczny, a nie automatyczna rekomendacja zakładu.

## Bezpieczeństwo

Sprint nie modyfikuje wyników ani statystyk istniejących meczów. Notatka analityczna jest przechowywana osobno dla każdego użytkownika, a każda jej zmiana trafia do audytu.
