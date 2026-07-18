@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Staty pilkarskie - bezpieczna aktualizacja GitHub

echo.
echo === Aktualizacja projektu na GitHub ===
where git >nul 2>nul
if errorlevel 1 (
  echo Brak programu Git for Windows.
  pause
  exit /b 1
)

if not exist .git (
  echo Ten skrypt uruchamiaj tylko wewnatrz sklonowanego repozytorium.
  pause
  exit /b 1
)

git config user.name "d25pgvm842-png"
git config user.email "305929032+d25pgvm842-png@users.noreply.github.com"
git remote set-url origin https://github.com/d25pgvm842-png/Statystyki-pilkarskie.git

echo Pobieranie najnowszego stanu repo...
git fetch origin main
if errorlevel 1 goto error

git pull --rebase origin main
if errorlevel 1 goto error

git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo Brak nowych zmian do wyslania.
  pause
  exit /b 0
)

git commit -m "Rozwoj aplikacji Staty pilkarskie"
if errorlevel 1 goto error

git push origin main
if errorlevel 1 goto error

echo.
echo GOTOWE. Zmiany sa na GitHub.
pause
exit /b 0

:error
echo.
echo Wystapil blad. Zrob screen calego okna i wyslij go w rozmowie.
pause
exit /b 1
