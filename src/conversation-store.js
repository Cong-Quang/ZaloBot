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

  appendUserMessage(threadId, text) {
    const entry = this.get(threadId);
    entry.messageCount += 1;
    entry.history.push({ role: 'user', text, at: new Date().toISOString() });
    entry.history = entry.history.slice(-20);
    return entry;
  }

  appendAssistantMessage(threadId, text) {
    const entry = this.get(threadId);
    entry.history.push({ role: 'assistant', text, at: new Date().toISOString() });
    entry.history = entry.history.slice(-20);
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
