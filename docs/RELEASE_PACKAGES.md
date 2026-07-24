# Paczki instalacyjne

Każda paczka sprintu dla Windows musi zawierać:

- `INSTALUJ.bat`,
- `install.ps1`,
- `manifest.json`,
- folder `payload`.

Instalator:

1. sam wyszukuje repozytorium po adresie `origin`,
2. wymaga czystego drzewa Git,
3. sprawdza commit bazowy paczki,
4. kopiuje wyłącznie pliki z manifestu,
5. aktualizuje `package-lock.json`,
6. uruchamia `npm ci`,
7. wykonuje Prisma generate, typecheck, lint, testy i build,
8. przy błędzie wraca do początkowego SHA,
9. usuwa wyłącznie nowe pliki dostarczone przez paczkę,
10. nie używa `git clean`, nie zmienia `.env` i nie dotyka bazy.

Udana instalacja pozostawia zweryfikowane zmiany bez automatycznego commita ani pushu.
