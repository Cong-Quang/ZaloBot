import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { appConfig } from './config.js';
import { logger } from './logger.js';

class JsonMessageStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { messages: [] };
    this.loaded = false;
    this.uploadDir = path.join(path.dirname(filePath), '..', 'uploads');
    // Đảm bảo thư mục uploads tồn tại
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async init() {
    try {
      const raw = await fsPromises.readFile(this.filePath, 'utf8');
      this.data = JSON.parse(raw);
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
      await this.flush();
    }
    this.loaded = true;
  }

  async flush() {
    await fsPromises.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async saveMessage(message) {
    // Xử lý lưu ảnh nếu có trong raw data
    if (message.raw && message.raw.data && message.raw.data.attachments) {
      await this.saveAttachmentsFromMessage(message);
    }
    
    this.data.messages.push(message);
    this.data.messages = this.data.messages.slice(-5000);
    await this.flush();
  }

  async saveAttachmentsFromMessage(message) {
    const attachments = message.raw.data.attachments || [];
    const imageTypes = ['photo', 'image'];
    
    for (const att of attachments) {
      if (imageTypes.includes(att.type) && att.url) {
        try {
          const axios = await import('axios');
          const response = await axios.default.get(att.url, {
            responseType: 'arraybuffer',
            timeout: 15000,
          });
          
          const ext = att.url.split('.').pop()?.split('?')[0] || 'jpg';
          const filename = `${message.threadId}-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const filepath = path.join(this.uploadDir, filename);
          
          await fsPromises.writeFile(filepath, response.data);
          
          // Cập nhật đường dẫn ảnh vào raw data
          att.localPath = `/uploads/${filename}`;
          logger.info({ filename, threadId: message.threadId }, 'Saved image from Zalo message');
        } catch (error) {
          logger.warn({ err: error, url: att.url }, 'Failed to download and save image');
        }
      }
    }
  }

  listThreads(limit = 100) {
    const map = new Map();
    for (const message of this.data.messages) {
      const prev = map.get(message.threadId) || { 
        threadId: message.threadId, 
        type: message.threadType, 
        lastMessageAt: message.at, 
        snippet: message.text, 
        count: 0,
        senderName: null,
        groupName: null,
        lastDirection: null
      };
      prev.lastMessageAt = message.at;
      prev.snippet = message.text;
      prev.count += 1;
      prev.lastDirection = message.direction;
      
      if (message.groupName) prev.groupName = message.groupName;
      if (message.direction === 'in' && message.senderName) {
        prev.senderName = message.senderName;
      }
      map.set(message.threadId, prev);
    }
    return [...map.values()]
      .map(t => ({ 
        ...t, 
        displayName: t.type === 'group' ? (t.groupName || t.threadId) : (t.senderName || t.threadId),
        needsReply: t.lastDirection === 'in' 
      }))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, limit);
  }

  async deleteThread(threadId) {
    this.data.messages = this.data.messages.filter((m) => m.threadId !== threadId);
    await this.flush();
  }

  listMessages(threadId, limit = 100) {
    return this.data.messages.filter((m) => !threadId || m.threadId === threadId).slice(-limit);
  }

  stats() {
    return { backend: 'json', messageCount: this.data.messages.length };
  }
}

class SqliteMessageStore {
  constructor(filePath) {
    // SQLite không được hỗ trợ trong Node.js 20, fallback về JSON store
    throw new Error('SQLite not available in Node.js 20');
  }
}

export async function createMessageStore() {
  try {
    const store = new SqliteMessageStore(appConfig.sqlitePath);
    await store.init();
    logger.info({ sqlitePath: appConfig.sqlitePath }, 'Using SQLite message store');
    return store;
  } catch (error) {
    logger.warn({ err: error }, 'SQLite unavailable, falling back to JSON store');
    const store = new JsonMessageStore(appConfig.messagesJsonPath);
    await store.init();
    return store;
  }
}

export function makeMessageRecord({ id, threadId, threadType, direction, senderId, senderName, groupName, text, raw }) {
  return {
    id,
    threadId,
    threadType,
    direction,
    senderId,
    senderName,
    groupName,
    text,
    raw,
    at: new Date().toISOString(),
  };
}
