import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationStore } from '../src/conversation-store.js';
import { MessageHandler } from '../src/message-handler.js';
import { buildSimulatedMessage } from '../src/simulate.js';

function createApiStub() {
  const calls = [];
  return {
    calls,
    async sendTypingEvent(threadId, type) {
      calls.push({ op: 'typing', threadId, type });
    },
    async sendMessage(payload, threadId, type) {
      calls.push({ op: 'send', payload, threadId, type });
      return { ok: true };
    },
  };
}

function createMessageStoreStub() {
  const rows = [];
  return {
    rows,
    async saveMessage(message) {
      rows.push(message);
    },
  };
}

function createHandler({ replyText }) {
  const api = createApiStub();
  const conversations = new ConversationStore();
  const messageStore = createMessageStoreStub();
  const settings = {
    aiBackend: 'mock',
    zaloGroupRequireMention: true,
    zaloFirstGreeting: 'Công Quang xin chào 👋',
    zaloIntroHint: 'Bạn có thể đặt tên cho bot và chọn vibe.',
  };

  const handler = new MessageHandler({
    api,
    ownId: 'bot-id',
    getSettings: async () => settings,
    createAiBackend: () => ({ async generateReply() { return replyText; } }),
    conversations,
    messageStore,
  });

  return { api, handler, messageStore };
}

test('replies in DM and prepends first greeting on first turn', async () => {
  const { api, handler, messageStore } = createHandler({ replyText: 'đây là phản hồi test' });
  const message = buildSimulatedMessage({ text: 'hello', type: 0, ownId: 'bot-id' });

  const result = await handler.handle(message);

  assert.equal(result.sent, true);
  assert.equal(api.calls.length, 2);
  assert.equal(api.calls[1].op, 'send');
  assert.match(api.calls[1].payload.msg, /Công Quang xin chào/);
  assert.match(api.calls[1].payload.msg, /đây là phản hồi test/);
  assert.equal(messageStore.rows.length, 2);
});

test('skips group message without mention when mention is required', async () => {
  const { api, handler } = createHandler({ replyText: 'đây là phản hồi test' });
  const message = buildSimulatedMessage({ text: 'hello group', type: 1, ownId: 'bot-id', mentionOwnId: false });

  const result = await handler.handle(message);

  assert.deepEqual(result, { skipped: 'group_no_mention' });
  assert.equal(api.calls.length, 0);
});

test('replies in group when bot is mentioned', async () => {
  const { api, handler, messageStore } = createHandler({ replyText: 'đây là phản hồi group' });
  const message = buildSimulatedMessage({ text: '@bot giúp mình', type: 1, ownId: 'bot-id', mentionOwnId: true });

  const result = await handler.handle(message);

  assert.equal(result.sent, true);
  assert.equal(api.calls.length, 2);
  assert.match(api.calls[1].payload.msg, /đây là phản hồi group/);
  assert.equal(messageStore.rows.length, 2);
});
