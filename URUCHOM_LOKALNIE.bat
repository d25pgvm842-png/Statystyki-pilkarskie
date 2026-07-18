@echo off
setlocal EnableExtensions
title Staty pilkarskie - uruchomienie lokalne
cd /d "%~dp0"

echo.
echo ============================================================
echo          STATY PILKARSKIE - URUCHOMIENIE LOKALNE
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo BLAD: Brak Node.js 22 lub nowszego.
  goto error
)

where docker >nul 2>nul
if errorlevel 1 (
  echo BLAD: Brak Docker Desktop.
  goto error
)

docker info >nul 2>nul
if errorlevel 1 (
  echo BLAD: Docker Desktop nie jest uruchomiony.
  echo Uruchom Docker Desktop, poczekaj na start silnika i sprobuj ponownie.
  goto error
)

if not exist ".env" (
  if not exist ".env.example" (
    echo BLAD: Brak pliku .env.example.
    goto error
  )

  copy /y ".env.example" ".env" >nul
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p='.env'; $c=[IO.File]::ReadAllText($p);" ^
    "$b=New-Object byte[] 48; $r=[Security.Cryptography.RandomNumberGenerator]::Create(); $r.GetBytes($b); $r.Dispose();" ^
    "$s=[Convert]::ToBase64String($b);" ^
    "$c=$c.Replace('zmien-na-losowy-ciag-minimum-32-znaki',$s);" ^
    "$c=$c.Replace('ADMIN_EMAIL=""admin@example.com""','ADMIN_EMAIL=""admin@staty.local""');" ^
    "$c=$c.Replace('ADMIN_PASSWORD=""zmien-mnie""','ADMIN_PASSWORD=""Staty-Start-2026!""');" ^
    "[IO.File]::WriteAllText($p,$c,(New-Object Text.UTF8Encoding($false)))"
  if errorlevel 1 goto error
  echo Utworzono plik .env.
)

echo [1/6] Uruchamiam PostgreSQL...
docker compose up -d
if errorlevel 1 goto error

echo Czekam na gotowosc bazy...
for /L %%I in (1,1,60) do (
  docker compose exec -T postgres pg_isready -U staty -d staty_pilkarskie >nul 2>nul
  if not errorlevel 1 goto database_ready
  timeout /t 2 /nobreak >nul
)
echo BLAD: PostgreSQL nie uruchomil sie w ciagu 2 minut.
goto error

:database_ready
echo [2/6] Instaluje zaleznosci...
call npm ci --ignore-scripts --registry=https://registry.npmjs.org/
if errorlevel 1 goto error

echo [3/6] Generuje Prisma Client...
call npm run db:generate
if errorlevel 1 goto error

echo [4/6] Wdraza migracje...
call npm run db:deploy
if errorlevel 1 goto error

echo [5/6] Aktualizuje dane startowe i konto administratora...
call npm run db:seed
if errorlevel 1 goto error

echo [6/6] Uruchamiam aplikacje...
echo.
echo Adres: http://localhost:3000
echo Login: admin@staty.local
echo Haslo: Staty-Start-2026!
echo.
echo Nie zamykaj tego okna podczas korzystania z aplikacji.
echo Zatrzymanie: Ctrl+C
echo.
start "" cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:3000"
call npm run dev
exit /b 0

:error
echo.
echo ============================================================
echo WYSTAPIL BLAD
echo ============================================================
echo Zrob screen calego okna i wyslij go w rozmowie.
echo.
pause
exit /b 1
