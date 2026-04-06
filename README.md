# 🤖 Zalo Bot Free

[![npm version](https://img.shields.io/npm/v/zalo-bot-free.svg)](https://www.npmjs.com/package/zalo-bot-free)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zalo Bot Free** là một giải pháp bot Zalo cá nhân chạy độc lập, tích hợp AI mạnh mẽ (OpenAI, Ollama, OpenRouter...) đi kèm với giao diện Admin Dashboard hiện đại, giúp bạn quản lý tin nhắn và cấu hình một cách chuyên nghiệp.

---

## ✨ Tính năng nổi bật

- 🔑 **Đăng nhập thông minh:** Quét mã QR linh hoạt từ Terminal hoặc Dashboard.
- 💾 **Duy trì phiên (Persistent):** Tự động lưu và khôi phục phiên đăng nhập, hạn chế quét lại QR.
- 🧠 **Đa nền tảng AI:** Hỗ trợ OpenAI, OpenRouter, Ollama (Local AI) và các API tương thích OpenAI.
- 📊 **Dashboard Toàn diện:** Giao diện Web trực quan để quản lý cấu hình, theo dõi lịch sử và gửi tin nhắn trực tiếp.
- 🗄️ **Lưu trữ tối ưu:** Sử dụng SQLite để đảm bảo hiệu năng và tính toàn vẹn dữ liệu.
- 🛠️ **CLI Ready:** Triển khai nhanh chóng chỉ với một lệnh duy nhất.

---

## 📋 Mục lục
- [🚀 Cài đặt nhanh (Khuyên dùng)](#-cài-đặt-nhanh-khuyên-dùng)
- [🛠️ Cài đặt từ mã nguồn](#️-cài-đặt-từ-mã-nguồn-dành-cho-developer)
- [⚙️ Cấu hình AI](#️-cấu-hình-ai)
- [🆙 Cập nhật (Upgrade)](#-cập-nhật-upgrade)
- [🗑️ Gỡ bỏ (Uninstall)](#️-gỡ-bỏ-uninstall)
- [⚠️ Lưu ý quan trọng](#️-lưu-ý-quan-trọng)

---

## 🚀 Cài đặt nhanh (Khuyên dùng)

Dành cho người dùng muốn sử dụng ngay lập tức:

1. **Cài đặt toàn cục:**
   ```bash
   npm install -g zalo-bot-free
   ```

2. **Khởi chạy:**
   ```bash
   zalo_bot
   ```

3. **Truy cập Dashboard:**
   Mở trình duyệt: `http://localhost:8787`
   - **Tài khoản:** `admin`
   - **Mật khẩu:** `admin123`

---

## 🛠️ Cài đặt từ mã nguồn (Dành cho Developer)

Dành cho các nhà phát triển muốn tùy chỉnh hoặc đóng góp:

1. **Clone repository:**
   ```bash
   git clone https://github.com/your-username/zalo-bot-free.git
   cd zalo-bot-free
   ```

2. **Cài đặt dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   ```bash
   cp .env.example .env
   ```

4. **Khởi động ứng dụng:**
   - **Windows:** `run.bat`
   - **Linux/macOS:** `./run.sh`

---

## ⚙️ Cấu hình AI

Cấu hình trực tiếp qua Dashboard hoặc chỉnh sửa tệp `.env`:

| Backend | Biến môi trường quan trọng |
| :--- | :--- |
| **OpenAI** | `AI_BACKEND=openai`, `OPENAI_API_KEY=your_key` |
| **OpenRouter** | `AI_BACKEND=openrouter`, `OPENROUTER_API_KEY=your_key` |
| **Ollama** | `AI_BACKEND=ollama`, `OLLAMA_BASE_URL=http://localhost:11434` |
| **Custom** | `AI_BACKEND=custom`, `CUSTOM_AI_BASE_URL=your_url` |

---

## 🆙 Cập nhật (Upgrade)

Dự án có tích hợp hệ thống thông báo tự động. Mỗi khi có phiên bản mới được publish lên NPM, bot sẽ hiển thị thông báo nhắc nhở ngay trong Terminal khi bạn khởi chạy.

Để thực hiện nâng cấp, bạn chỉ cần chạy lệnh tương ứng:

### Nếu cài qua NPM (Global):
```bash
# Lệnh này sẽ tải bản mới nhất về và cài đặt đè lên bản cũ
npm install -g zalo-bot-free@latest
```

### Nếu cài từ mã nguồn (GitHub):
```bash
git pull origin main
npm install
```

---

## 🗑️ Gỡ bỏ (Uninstall)

### Qua NPM:
```bash
npm uninstall -g zalo-bot-free
```

### Qua mã nguồn:
- **Windows:** Chạy `uninstall.bat`.
- **Linux/macOS:** Thực thi `./uninstall.sh`.

---

## ⚠️ Lưu ý quan trọng

- **Bảo mật:** Không chia sẻ tệp `storage/` hoặc `.env` chứa API Key.
- **Rủi ro:** Dự án sử dụng API không chính thức (`zca-js`). Việc lạm dụng có thể dẫn đến khóa tài khoản Zalo. Hãy sử dụng có trách nhiệm.

---

## 📄 Giấy phép

Phát hành dưới giấy phép [MIT](LICENSE).
