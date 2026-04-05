import { logger } from './logger.js';
import { extractTextContent, isThreadAllowed, shouldReplyInGroup, shouldSendFirstGreeting } from './policies.js';
import { makeMessageRecord } from './message-store.js';

export class MessageHandler {
  constructor({ api, ownId, getSettings, createAiBackend, conversations, messageStore }) {
    this.api = api;
    this.ownId = ownId;
    this.getSettings = getSettings;
    this.createAiBackend = createAiBackend;
    this.conversations = conversations;
    this.messageStore = messageStore;
  }

  async handle(message) {
    const settings = await this.getSettings();
    const text = extractTextContent(message);
    
    // 1. Bỏ qua nếu là tin nhắn của chính mình hoặc tin nhắn trống
    if (message.isSelf || !text) return { skipped: 'self_or_empty' };
    
    // 2. Kiểm tra Policy (whitelist/blacklist thread nếu có cấu hình)
    if (!isThreadAllowed(message)) return { skipped: 'policy_blocked' };

    const threadType = message.type === 1 ? 'group' : 'dm';
    
    // 3. LUÔN LUÔN LƯU VÀO DATABASE VÀ BỘ NHỚ (Để xây dựng lịch sử chat)
    const senderName = message.data.dName || message.data.displayName || null;
    const groupName = threadType === 'group' ? (message.data.gName || message.data.groupName || null) : null;

    // Lưu vào SQLite
    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `in-${message.threadId}-${message.data.msgId || Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'in',
        senderId: message.data.uidFrom || null,
        senderName: senderName,
        groupName: groupName,
        text,
        raw: message,
      }),
    );

    // Lưu vào bộ nhớ tạm phiên làm việc
    this.conversations.appendUserMessage(message.threadId, text);

    // 4. KIỂM TRA ĐIỀU KIỆN TRẢ LỜI
    // Nếu trong nhóm và KHÔNG được tag tên -> Kết thúc tại đây (chỉ lưu, không rep)
    if (!shouldReplyInGroup(message, this.ownId, settings)) {
      return { skipped: 'silent_listening_for_history' };
    }

    // 5. NẠP LỊCH SỬ TỪ DATABASE NẾU CẦN (Để AI có trí nhớ dài hạn khi bắt đầu rep)
    const memory = this.conversations.get(message.threadId);
    if (memory.history.length <= 1) { // Chỉ có 1 tin vừa lưu ở trên
      const dbHistory = await this.messageStore.listMessages(message.threadId, 30);
      // Xóa history tạm thời để nạp lại từ DB cho chuẩn thứ tự
      memory.history = [];
      for (const m of dbHistory) {
        if (m.direction === 'in') {
          this.conversations.appendUserMessage(message.threadId, m.text);
        } else {
          this.conversations.appendAssistantMessage(message.threadId, m.text);
        }
      }
    }

    // 6. GỌI AI ĐỂ TRẢ LỜI
    const aiBackend = this.createAiBackend(settings);
    
    let model = settings.openaiModel;
    if (settings.aiBackend === 'openrouter') model = settings.openrouterModel;
    if (settings.aiBackend === 'ollama') model = settings.ollamaModel;
    if (settings.aiBackend === 'custom') model = settings.customAiModel;

    const systemPromptEnhanced = `${settings.systemPrompt}\n\nLƯU Ý: Bạn đang xem lịch sử hội thoại gồm nhiều người. Hãy sử dụng ngữ cảnh này để trả lời hoặc tóm tắt nếu được yêu cầu. Trả lời ngắn gọn, tự nhiên.`;

    let reply = await aiBackend.generateReply({
      text,
      memory: this.conversations.get(message.threadId),
      threadType,
      settings: {
        ...settings,
        systemPrompt: systemPromptEnhanced,
        model: model
      },
    });

    // 7. XỬ LÝ CÂU CHÀO ĐẦU (Chỉ cho cá nhân)
    if (threadType === 'dm' && shouldSendFirstGreeting(memory)) {
      reply = `${settings.zaloFirstGreeting}\n${settings.zaloIntroHint}\n\n${reply}`;
    }

    // 8. GỬI TIN NHẮN
    try {
      await this.api.sendTypingEvent(message.threadId, message.type);
    } catch (error) {
      logger.debug({ err: error }, 'sendTypingEvent failed');
    }

    await this.api.sendMessage(
      {
        msg: reply,
        quote: message.data,
      },
      message.threadId,
      message.type,
    );

    // 9. LƯU TIN NHẮN BOT VÀO LỊCH SỬ
    this.conversations.appendAssistantMessage(message.threadId, reply);
    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `out-${message.threadId}-${Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'out',
        senderId: this.ownId,
        senderName: 'bot',
        groupName: groupName,
        text: reply,
        raw: { quoteTo: message.data.msgId || null },
      }),
    );

    return { sent: true, reply };
  }
}
