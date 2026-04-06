# 🤖 Zalo Standalone Bot

[![npm version](https://img.shields.io/npm/v/zalo-standalone-bot.svg)](https://www.npmjs.com/package/zalo-standalone-bot)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zalo Standalone Bot** là một bot Zalo cá nhân chạy độc lập, hỗ trợ AI (OpenAI, Ollama, OpenRouter...) với giao diện Admin Dashboard hiện đại để quản lý tin nhắn và cấu hình.

---

## ✨ Tính năng nổi bật

- 🔑 **Đăng nhập QR:** Quét mã QR trực tiếp từ Terminal hoặc Dashboard.
- 💾 **Session Persistent:** Tự động lưu và khôi phục phiên đăng nhập.
- 🧠 **AI Multi-Backend:** Hỗ trợ OpenAI, OpenRouter, Ollama (Local AI) và Custom OpenAI-compatible API.
- 📊 **Admin Dashboard:** Giao diện web quản lý cấu hình, xem lịch sử tin nhắn, gửi tin nhắn thủ công.
- 🗄️ **Database:** Sử dụng SQLite (ưu tiên) hoặc JSON để lưu trữ tin nhắn.
- 🛠️ **CLI Ready:** Chạy trực tiếp qua lệnh terminal sau khi cài đặt.

---

## 📋 Mục lục
- [🚀 Cài đặt nhanh (Khuyên dùng)](#-cài-đặt-nhanh-khuyên-dùng)
- [🛠️ Cài đặt từ mã nguồn](#️-cài-đặt-từ-mã-nguồn-dành-cho-developer)
- [⚙️ Cấu hình AI](#️-cấu-hình-ai)
- [🆙 Cập nhật (Upgrade)](#-cập-nhật-upgrade)
- [🗑️ Gỡ bỏ (Uninstall)](#️-gỡ-bỏ-uninstall)
- [⚠️ Lưu ý bảo mật](#️-lưu-ý-bảo-mật-và-bản-quyền)

---

## 🚀 Cài đặt nhanh (Khuyên dùng)

Nếu bạn chỉ muốn sử dụng bot ngay lập tức:

1. **Cài đặt toàn cục:**
   ```bash
   npm install -g zalo-standalone-bot
   ```

2. **Khởi chạy:**
   ```bash
   zalo_bot
   ```

3. **Truy cập Dashboard:**
   Mở trình duyệt: `http://localhost:8787`
   - Tài khoản mặc định: `admin`
   - Mật khẩu mặc định: `admin123`

---

## 🛠️ Cài đặt từ mã nguồn (Dành cho Developer)

Nếu bạn muốn tùy chỉnh mã nguồn và đóng góp cho dự án:

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-username/zalo-standalone-bot.git
   cd zalo-standalone-bot
   ```

2. **Cài đặt thư viện:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   Sao chép tệp mẫu và chỉnh sửa:
   ```bash
   cp .env.example .env
   ```

4. **Chạy bot:**
   ```bash
   # Windows
   run.bat
   
   # Linux/macOS
   ./run.sh
   ```

---

## ⚙️ Cấu hình AI

Bạn có thể chỉnh sửa trực tiếp trong Dashboard hoặc tệp `.env`:

| Backend | Biến môi trường cần thiết |
| :--- | :--- |
| **OpenAI** | `AI_BACKEND=openai`, `OPENAI_API_KEY=...` |
| **OpenRouter** | `AI_BACKEND=openrouter`, `OPENROUTER_API_KEY=...` |
| **Ollama** | `AI_BACKEND=ollama`, `OLLAMA_BASE_URL=http://localhost:11434` |
| **Custom** | `AI_BACKEND=custom`, `CUSTOM_AI_BASE_URL=...` |

---

## 🆙 Cập nhật (Upgrade)

Khi có phiên bản mới được phát hành trên npm, bạn có thể dễ dàng nâng cấp bằng các lệnh sau:

### Nếu cài qua NPM (Global):
```bash
# Kiểm tra bản mới và nâng cấp
npm install -g zalo-standalone-bot@latest
```

### Nếu cài từ mã nguồn (GitHub):
```bash
git pull origin main
npm install
```

---

## 🗑️ Gỡ bỏ (Uninstall)

### Nếu cài qua NPM:
```bash
npm uninstall -g zalo-standalone-bot
```

### Nếu cài từ mã nguồn:
- **Windows:** Chạy tệp `uninstall.bat`.
- **Linux/macOS:** Chạy lệnh `./uninstall.sh`.

---

## ⚠️ Lưu ý bảo mật và bản quyền

- Dự án sử dụng `zca-js` (Unofficial API). Có rủi ro bị khóa tài khoản Zalo nếu lạm dụng hoặc vi phạm chính sách của Zalo.
- Tuyệt đối **không chia sẻ tệp `storage/`** hoặc `.env` chứa API Key cho người khác.

---

## 📄 Giấy phép

Dự án được phát hành dưới giấy phép [MIT](LICENSE).
