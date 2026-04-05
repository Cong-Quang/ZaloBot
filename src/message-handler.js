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
    if (message.isSelf || !text) return { skipped: 'self_or_empty' };
    if (!isThreadAllowed(message)) return { skipped: 'policy_blocked' };
    if (!shouldReplyInGroup(message, this.ownId, settings)) return { skipped: 'group_no_mention' };

    const threadType = message.type === 1 ? 'group' : 'dm';
    const memory = this.conversations.appendUserMessage(message.threadId, text);

    // Lấy tên người gửi và tên nhóm (nếu có)
    const senderName = message.data.dName || message.data.displayName || null;
    const groupName = threadType === 'group' ? (message.data.gName || message.data.groupName || null) : null;

    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `in-${message.threadId}-${message.data.msgId || Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'in',
        senderId: message.data.uidFrom || null,
        senderName: senderName,
        groupName: groupName, // Thêm trường này
        text,
        raw: message,
      }),
    );

    const aiBackend = this.createAiBackend(settings);
    
    // Select the correct model based on backend
    let model = settings.openaiModel;
    if (settings.aiBackend === 'openrouter') model = settings.openrouterModel;
    if (settings.aiBackend === 'ollama') model = settings.ollamaModel;
    if (settings.aiBackend === 'custom') model = settings.customAiModel;

    let reply = await aiBackend.generateReply({
      text,
      memory,
      threadType,
      settings: {
        ...settings,
        model: model
      },
    });

    if (threadType === 'dm' && shouldSendFirstGreeting(memory)) {
      reply = `${settings.zaloFirstGreeting}\n${settings.zaloIntroHint}\n\n${reply}`;
    }

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

    this.conversations.appendAssistantMessage(message.threadId, reply);
    await this.messageStore.saveMessage(
      makeMessageRecord({
        id: `out-${message.threadId}-${Date.now()}`,
        threadId: message.threadId,
        threadType,
        direction: 'out',
        senderId: this.ownId,
        senderName: 'bot',
        text: reply,
        raw: { quoteTo: message.data.msgId || null },
      }),
    );

    return { sent: true, reply };
  }
}
