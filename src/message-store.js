import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { appConfig } from './config.js';
import { logger } from './logger.js';

class JsonMessageStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { messages: [] };
    this.loaded = false;
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
    this.data.messages.push(message);
    this.data.messages = this.data.messages.slice(-5000);
    await this.flush();
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
    this.db = new DatabaseSync(filePath);
  }

  async init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        thread_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        group_name TEXT,
        text TEXT NOT NULL,
        raw_json TEXT,
        at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_thread_at ON messages(thread_id, at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_at ON messages(at DESC);
    `);
  }

  async saveMessage(message) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO messages (id, thread_id, thread_type, direction, sender_id, sender_name, group_name, text, raw_json, at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      message.id,
      message.threadId,
      message.threadType,
      message.direction,
      message.senderId,
      message.senderName,
      message.groupName,
      message.text,
      JSON.stringify(message.raw || null),
      message.at,
    );
  }

  listThreads(limit = 100) {
    const stmt = this.db.prepare(`
      SELECT thread_id as threadId,
             thread_type as type,
             MAX(at) as lastMessageAt,
             (SELECT text FROM messages m2 WHERE m2.thread_id = m1.thread_id ORDER BY at DESC LIMIT 1) as snippet,
             (SELECT group_name FROM messages mgroup WHERE mgroup.thread_id = m1.thread_id AND group_name IS NOT NULL ORDER BY at DESC LIMIT 1) as groupName,
             (SELECT sender_name FROM messages m3 WHERE m3.thread_id = m1.thread_id AND direction = 'in' AND sender_name IS NOT NULL ORDER BY at DESC LIMIT 1) as senderName,
             (SELECT direction FROM messages m4 WHERE m4.thread_id = m1.thread_id ORDER BY at DESC LIMIT 1) as lastDirection,
             COUNT(*) as count
      FROM messages m1
      GROUP BY thread_id, thread_type
      ORDER BY lastMessageAt DESC
      LIMIT ?
    `);
    const rows = stmt.all(limit);
    return rows.map((r) => ({
      ...r,
      displayName: r.type === 'group' ? (r.groupName || r.threadId) : (r.senderName || r.threadId),
      needsReply: r.lastDirection === 'in',
    }));
  }

  async deleteThread(threadId) {
    const stmt = this.db.prepare('DELETE FROM messages WHERE thread_id = ?');
    stmt.run(threadId);
  }

  listMessages(threadId, limit = 100) {
    if (threadId) {
      const stmt = this.db.prepare(`
        SELECT id, thread_id as threadId, thread_type as threadType, direction, sender_id as senderId, sender_name as senderName, text, at
        FROM messages
        WHERE thread_id = ?
        ORDER BY at DESC
        LIMIT ?
      `);
      return stmt.all(threadId, limit).reverse();
    }

    const stmt = this.db.prepare(`
      SELECT id, thread_id as threadId, thread_type as threadType, direction, sender_id as senderId, sender_name as senderName, text, at
      FROM messages
      ORDER BY at DESC
      LIMIT ?
    `);
    return stmt.all(limit).reverse();
  }

  stats() {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
    return { backend: 'sqlite', messageCount: row.count };
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
