export class ConversationStore {
  constructor() {
    this.store = new Map();
  }

  get(threadId) {
    if (!this.store.has(threadId)) {
      this.store.set(threadId, { firstSeenAt: new Date().toISOString(), messageCount: 0, history: [] });
    }
    return this.store.get(threadId);
  }

  appendUserMessage(threadId, text, senderName = null) {
    const entry = this.get(threadId);
    entry.messageCount += 1;
    entry.history.push({ 
      role: 'user', 
      text, 
      senderName, 
      at: new Date().toISOString() 
    });
    entry.history = entry.history.slice(-30); // Tăng lên 30 tin để tóm tắt tốt hơn
    return entry;
  }

  appendAssistantMessage(threadId, text) {
    const entry = this.get(threadId);
    entry.history.push({ 
      role: 'assistant', 
      text, 
      senderName: 'Bot', 
      at: new Date().toISOString() 
    });
    entry.history = entry.history.slice(-30);
    return entry;
  }

  clearThread(threadId) {
    this.store.delete(threadId);
  }

  stats() {
    return {
      threadCount: this.store.size,
    };
  }
}
