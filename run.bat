@echo off
setlocal
cd /d %~dp0

echo [1/4] Checking .env...
if not exist .env (
  if exist .env.example (
    copy /Y .env.example .env >nul
    echo Created .env from .env.example
  ) else (
    echo Missing .env.example
    exit /b 1
  )
)

echo [2/4] Checking node_modules...
if not exist node_modules (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo [3/4] Host bind mac dinh: 0.0.0.0 (xem URL truy cap that trong log app)
echo [4/4] Starting app...
start http://127.0.0.1:8787/login
call npm start

endlocal
