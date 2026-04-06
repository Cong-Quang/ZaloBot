#!/bin/bash
echo "[!] Warning: This will delete all local data (sessions, messages, settings)."
read -p "Are you sure you want to uninstall and delete data? (y/n): " confirm
if [ "$confirm" != "y" ]; then
    exit 0
fi

echo "[1/3] Removing node_modules..."
rm -rf node_modules

echo "[2/3] Removing storage (sessions & database)..."
rm -rf storage

echo "[3/3] Removing environment file..."
rm -f .env

echo "[OK] Local files and data removed."
echo "Note: If you installed via 'npm install -g', run 'npm uninstall -g zalo-bot-free' to remove the command."
