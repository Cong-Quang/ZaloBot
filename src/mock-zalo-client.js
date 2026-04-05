import { EventEmitter } from 'node:events';

class MockListener extends EventEmitter {
  start() {
    queueMicrotask(() => this.emit('connected'));
  }

  stop() {}
}

export async function connectMockZalo(qrState) {
  const listener = new MockListener();
  qrState?.set({
    type: 'mock',
    code: 'MOCK-QR',
    image: '',
    at: new Date().toISOString(),
  });

  return {
    ctx: {
      imei: 'mock-imei',
      userAgent: 'mock-agent',
    },
    listener,
    getOwnId() {
      return 'mock-bot-id';
    },
    async fetchAccountInfo() {
      return {
        profile: {
          userId: 'mock-bot-id',
          displayName: 'Mock Zalo Bot',
        },
      };
    },
    getCookie() {
      return {
        serializeSync() {
          return { cookies: [] };
        },
      };
    },
    async sendTypingEvent(threadId, type) {
      return { status: 1, threadId, type };
    },
    async sendMessage(payload, threadId, type) {
      return { message: { msgId: Date.now() }, attachment: [], payload, threadId, type };
    },
  };
}
