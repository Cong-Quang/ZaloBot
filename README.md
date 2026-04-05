# Zalo Standalone Bot

Bot Zalo cá nhân chạy độc lập, không phụ thuộc OpenClaw runtime.

## Có gì sẵn

- Đăng nhập Zalo bằng QR và lưu session cục bộ
- Có thể show QR ngay trên **admin dashboard**
- Trả lời DM
- Chỉ trả lời trong group khi được mention (mặc định, chỉnh được trong dashboard)
- AI provider đa nguồn:
  - `mock`
  - `openai`
  - `openrouter`
  - `ollama`
  - `custom` (OpenAI-compatible endpoint)
- Admin dashboard có **đăng nhập**
- Quản lý settings AI/prompt/policy
- Xem thread + lịch sử tin nhắn
- Gửi manual reply
- Message store ưu tiên **SQLite** (`node:sqlite`, không cần native build), fallback JSON nếu cần
- Có unit test + smoke test full app ở chế độ mock

## Kiến trúc

- `zca-js`: kết nối Zalo cá nhân
- `src/zalo-client.js`: login, restore session, QR flow
- `src/message-store.js`: SQLite first, fallback JSON
- `src/message-handler.js`: policy + reply pipeline + lưu message
- `src/ai/*`: AI backend router
- `src/http-server.js`: admin API + auth
- `public/*`: dashboard UI

## Cài đặt

```bash
cd projects/zalo-standalone-bot
cp .env.example .env
npm install
```

Trong `.env`, mặc định nên để:

```env
HOST=0.0.0.0
PORT=8787
```

## Chạy

### Linux / macOS / WSL / tmux

```bash
chmod +x run.sh
./run.sh
```

Hoặc chạy thẳng:

```bash
npm start
```

### Windows

```bat
run.bat
```

Mở dashboard:

```text
http://127.0.0.1:8787
```

Mặc định app bind ra `0.0.0.0` để dễ truy cập từ Windows ↔ WSL và trong mạng LAN. Khi chạy, app sẽ in ra các URL truy cập khả dụng cùng IP máy.

Mặc định:
- user: `admin`
- pass: `admin123`

> Nhớ đổi lại trong `.env` trước khi dùng thật.

## Cấu hình AI

### OpenAI

```env
AI_BACKEND=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

### OpenRouter

```env
AI_BACKEND=openrouter
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

### Ollama

```env
AI_BACKEND=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

### Custom endpoint

```env
AI_BACKEND=custom
CUSTOM_AI_BASE_URL=https://your-endpoint/v1
CUSTOM_AI_API_KEY=...
CUSTOM_AI_MODEL=your-model
```

## Test không cần login Zalo

```env
AI_BACKEND=mock
ZALO_TRANSPORT=mock
```

## File runtime

- `storage/zalo-session.json`: session đã lưu
- `storage/zalo-qr.json`: trạng thái QR mới nhất (dashboard sẽ render QR ảnh trực tiếp từ mã login)
- `storage/settings.json`: settings dashboard
- `storage/messages.sqlite`: database message
- `storage/messages.json`: fallback nếu SQLite lỗi

## API nội bộ

- `POST /api/login`
- `POST /api/logout`
- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/threads`
- `GET /api/messages?threadId=...`
- `GET /api/qr`
- `GET /api/logs`
- `POST /api/manual-reply`
- `POST /api/simulate`

## Lưu ý

- `zca-js` là unofficial API, có rủi ro khóa tài khoản.
- Chỉ 1 web listener hoạt động cho 1 account tại một thời điểm.
- Nếu mở Zalo Web cùng lúc, listener có thể bị đá.
- Dashboard auth hiện là session cookie đơn giản, phù hợp self-host nội bộ; nếu public internet thì nên thêm reverse proxy + HTTPS.
- Dashboard có log realtime cơ bản để chẩn đoán QR/login/runtime.
- Nếu bot public internet thật, nên thêm reverse proxy (Nginx/Caddy), HTTPS, firewall, đổi mật khẩu admin mạnh, và cân nhắc giới hạn IP truy cập dashboard.
