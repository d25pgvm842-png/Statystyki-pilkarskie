@echo off
setlocal
cd /d "%~dp0"
title Staty pilkarskie - konfiguracja lokalna

echo.
echo === Staty pilkarskie: konfiguracja lokalna ===

where node >nul 2>nul
if errorlevel 1 (
  echo Brak Node.js. Zainstaluj Node.js 22 LTS ze strony nodejs.org i uruchom plik ponownie.
  pause
  exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
  echo Brak Docker Desktop. Zainstaluj Docker Desktop i uruchom plik ponownie.
  pause
  exit /b 1
)

if not exist .env (
  powershell -NoProfile -Command "$secret=[Convert]::ToBase64String((1..48|%%{Get-Random -Maximum 256})); (Get-Content '.env.example') -replace 'zmien-na-losowy-ciag-minimum-32-znaki',$secret -replace 'admin@example.com','admin@staty.local' -replace 'ADMIN_PASSWORD=\"zmien-mnie\"','ADMIN_PASSWORD=\"Staty-Start-2026!\"' | Set-Content '.env' -Encoding UTF8"
  echo Utworzono plik .env.
)

echo Uruchamiam PostgreSQL...
docker compose up -d
if errorlevel 1 goto error

echo Instaluje zaleznosci...
call npm ci
if errorlevel 1 goto error

echo Generuje klienta Prisma...
call npm run db:generate
if errorlevel 1 goto error

echo Tworze strukture bazy...
call npm run db:migrate -- --name init_local
if errorlevel 1 goto error

echo Dodaje dane startowe...
call npm run db:seed
if errorlevel 1 goto error

echo.
echo GOTOWE.
echo Login: admin@staty.local
echo Haslo: Staty-Start-2026!
echo Aplikacja: http://localhost:3000
echo.
echo Uruchamiam serwer. Nie zamykaj tego okna podczas korzystania z aplikacji.
call npm run dev
exit /b 0

:error
echo.
echo Wystapil blad. Zrob screen calego okna i wyslij go w rozmowie.
pause
exit /b 1
