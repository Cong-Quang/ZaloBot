import { logger } from './logger.js';
import { extractTextContent, isThreadAllowed, shouldReplyInGroup, shouldSendFirstGreeting } from './policies.js';
import { makeMessageRecord } from './message-store.js';
import axios from 'axios';

async function extractImageUrls(message) {
  const urls = [];
  
  // Zalo gửi ảnh qua data.attachments hoặc data.photo
  const attachments = message?.data?.attachments || [];
  const photoUrl = message?.data?.photo;
  
  for (const att of attachments) {
    if (att.type === 'photo' || att.type === 'image') {
      if (att.url) urls.push(att.url);
      if (att.originalUrl) urls.push(att.originalUrl);
    }
  }
  
  if (photoUrl) {
    urls.push(photoUrl);
  }
  
  return [...new Set(urls)]; // Loại bỏ trùng lặp
}

async function downloadImageAsBase64(url) {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
    });
    const base64 = Buffer.from(response.data).toString('base64');
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    logger.warn({ err: error, url }, 'Failed to download image');
    return null;
  }
}

async function extractTextFromImages(imageUrls, aiBackend, settings) {
  if (imageUrls.length === 0) return '';
  
  logger.info({ count: imageUrls.length }, 'Extracting text from images');
  
  const imageContents = [];
  for (const url of imageUrls) {
    const base64 = await downloadImageAsBase64(url);
    if (base64) {
      imageContents.push(base64);
    }
  }
  
  if (imageContents.length === 0) return '';
  
  try {
    let model = settings.openaiModel;
    if (settings.aiBackend === 'openrouter') model = settings.openrouterModel;
    if (settings.aiBackend === 'ollama') model = settings.ollamaModel;
    if (settings.aiBackend === 'custom') model = settings.customAiModel;
    
    const userContent = [
      { type: 'text', text: 'Hãy đọc và trích xuất toàn bộ văn bản có trong hình ảnh này. Chỉ trả về nội dung văn bản, không thêm giải thích.' }
    ];
    
    for (const base64 of imageContents) {
      userContent.push({ type: 'image_url', image_url: { url: base64 } });
    }
    
    const response = await aiBackend.client.chat.completions.create({
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ],
      max_tokens: 2000,
    });
    
    const extractedText = response.choices[0]?.message?.content || '';
    logger.info({ extractedText: extractedText.substring(0, 100) }, 'Successfully extracted text from images');
    return extractedText;
  } catch (error) {
    logger.error({ err: error }, 'Failed to extract text from images');
    return '';
  }
}

function cleanMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/###?\s+/g, '')
    .trim();
}

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
    
    // Kiểm tra nếu có ảnh gửi đến
    const imageUrls = await extractImageUrls(message);
    let imageText = '';
    
    if (imageUrls.length > 0) {
      imageText = await extractTextFromImages(imageUrls, this.createAiBackend(settings), settings);
    }
    
    // Nếu chỉ có ảnh không có text thì vẫn xử lý
    if (message.isSelf && !text && imageText === '') return { skipped: 'self_or_empty' };
    if (!isThreadAllowed(message)) return { skipped: 'policy_blocked' };

    const threadType = message.type === 1 ? 'group' : 'dm';
    const senderName = message.data.dName || message.data.displayName || null;
    const groupName = threadType === 'group' ? (message.data.gName || message.data.groupName || null) : null;

    // Kết hợp text từ tin nhắn và text trích xuất từ ảnh
    const combinedText = imageText ? (text ? `${text}\n\n[Văn bản từ hình ảnh]:\n${imageText}` : `[Văn bản từ hình ảnh]:\n${imageText}`) : text;

    // 1. Lưu vào SQLite
    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `in-${message.threadId}-${message.data.msgId || Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'in',
        senderId: message.data.uidFrom || null,
        senderName: senderName,
        groupName: groupName,
        text: combinedText,
        raw: message,
      }),
    );

    // 2. Lưu vào bộ nhớ (Có tên)
    this.conversations.appendUserMessage(message.threadId, combinedText, senderName);

    // 3. Kiểm tra tag tên (@Mention)
    if (!shouldReplyInGroup(message, this.ownId, settings)) {
      return { skipped: 'silent_listening_for_history' };
    }

    // 4. Đồng bộ lịch sử từ DB (Nếu bộ nhớ mới khởi tạo)
    const memory = this.conversations.get(message.threadId);
    if (memory.history.length <= 1) {
      const dbHistory = await this.messageStore.listMessages(message.threadId, 30);
      memory.history = [];
      for (const m of dbHistory) {
        if (m.direction === 'in') {
          this.conversations.appendUserMessage(message.threadId, m.text, m.senderName);
        } else {
          this.conversations.appendAssistantMessage(message.threadId, m.text);
        }
      }
    }

    // 5. Gọi AI
    const aiBackend = this.createAiBackend(settings);
    let model = settings.openaiModel;
    if (settings.aiBackend === 'openrouter') model = settings.openrouterModel;
    if (settings.aiBackend === 'ollama') model = settings.ollamaModel;
    if (settings.aiBackend === 'custom') model = settings.customAiModel;

    const botName = settings.botDisplayName || "Bot";
    const systemPromptEnhanced = `${settings.systemPrompt}
---
QUY TẮC PHẢN HỒI:
- Bạn là AI trợ lý tên "${botName}". Bạn đang ở trong ${threadType === 'group' ? `nhóm "${groupName}"` : "hội thoại riêng"}.
- Bạn sẽ nhận được Lịch sử hội thoại bên trên. Hãy đọc kỹ nó.
- Khi người dùng yêu cầu "tóm tắt", hãy phân tích các tin nhắn trong lịch sử và đưa ra bản tóm tắt ngắn gọn theo từng ý chính. 
- TUYỆT ĐỐI KHÔNG lặp lại tin nhắn của người dùng một cách máy móc.
- Trả lời bằng tiếng Việt tự nhiên, không dùng Markdown (không **, không [], không #).
- Nếu không có đủ thông tin để tóm tắt, hãy lịch sự yêu cầu thêm thông tin.`;

    let aiReply = await aiBackend.generateReply({
      text: combinedText,
      memory: this.conversations.get(message.threadId),
      threadType,
      settings: {
        ...settings,
        systemPrompt: systemPromptEnhanced,
        model: model
      },
    });

    let reply = cleanMarkdown(aiReply);

    if (threadType === 'dm' && shouldSendFirstGreeting(memory)) {
      reply = `${settings.zaloFirstGreeting}\n${settings.zaloIntroHint}\n\n${reply}`;
    }

    try {
      await this.api.sendTypingEvent(message.threadId, message.type);
    } catch (error) {
      logger.debug({ err: error }, 'sendTypingEvent failed');
    }

    await this.api.sendMessage({ msg: reply, quote: message.data }, message.threadId, message.type);

    // 6. Lưu tin nhắn bot
    this.conversations.appendAssistantMessage(message.threadId, reply);
    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `out-${message.threadId}-${Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'out',
        senderId: this.ownId,
        senderName: botName,
        groupName: groupName,
        text: reply,
        raw: { quoteTo: message.data.msgId || null },
      }),
    );

    return { sent: true, reply };
  }
}
