import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createMessageStore, makeMessageRecord } from '../src/message-store.js';

test('message store boots and persists rows', async () => {
  const storageDir = path.resolve(process.cwd(), 'storage');
  fs.mkdirSync(storageDir, { recursive: true });
  const store = await createMessageStore();
  await store.saveMessage(makeMessageRecord({
    id: `test-${Date.now()}`,
    threadId: 'thread-1',
    threadType: 'dm',
    direction: 'in',
    senderId: 'u1',
    senderName: 'User',
    text: 'hello',
    raw: { ok: true },
  }));
  const threads = store.listThreads(10);
  assert.ok(Array.isArray(threads));
  assert.ok(threads.length >= 1);
});
