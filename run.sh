#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/4] Checking .env..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
  else
    echo "Missing .env.example"
    exit 1
  fi
fi

echo "[2/4] Checking node_modules..."
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "[3/4] Host bind mặc định: 0.0.0.0"
echo "      Nếu đang chạy WSL, thử từ Windows: http://127.0.0.1:8787/"
echo "      Nếu cần màn hình đăng nhập trực tiếp thì thêm /login"
echo "      Nếu vẫn không vào được, dùng IP mà app in ra sau khi start"
echo "[4/4] Starting app..."
exec npm start
