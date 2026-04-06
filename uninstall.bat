@echo off
setlocal
echo [!] Warning: This will delete all local data (sessions, messages, settings).
set /p confirm="Are you sure you want to uninstall and delete data? (y/n): "
if /i "%confirm%" neq "y" exit /b

echo [1/3] Removing node_modules...
if exist node_modules (
    rmdir /s /q node_modules
)

echo [2/3] Removing storage (sessions & database)...
if exist storage (
    rmdir /s /q storage
)

echo [3/3] Removing environment file...
if exist .env (
    del .env
)

echo [OK] Local files and data removed. 
echo Note: If you installed via 'npm install -g', run 'npm uninstall -g zalo-standalone-bot' to remove the command.
pause
