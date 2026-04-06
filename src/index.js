#!/usr/bin/env node
import updateNotifier from 'update-notifier';
import fs from 'node:fs';
import { createAiBackend } from './ai/index.js';
import { ConversationStore } from './conversation-store.js';
import { appConfig, ensureRuntimeDirs } from './config.js';
import { createHttpServer } from './http-server.js';
import { LogBuffer } from './log-buffer.js';
import { logger } from './logger.js';
import { MessageHandler } from './message-handler.js';
import { createMessageStore, makeMessageRecord } from './message-store.js';
import { connectMockZalo } from './mock-zalo-client.js';
import { QrState } from './qr-state.js';
import { loadSettings, saveSettings } from './settings-store.js';
import { buildSimulatedMessage } from './simulate.js';
import { connectZalo } from './zalo-client.js';
import { clearQrPayload, clearSession } from './session-store.js';

// Check for updates
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
updateNotifier({ pkg }).notify();

ensureRuntimeDirs();

// Force UTF-8 for Windows Terminal
if (process.platform === 'win32') {
  try {
    const { execSync } = await import('node:child_process');
    execSync('chcp 65001');
  } catch (e) {
    // Ignore error if fails
  }
}

const state = {
  connected: false,
  ownId: null,
  account: null,
  settings: null,
  loginStatus: 'booting',
  loginError: null,
};

const runtime = {
  api: null,
  handler: null,
};

const conversations = new ConversationStore();
const qrState = new QrState();
const logBuffer = new LogBuffer();

function resetRuntimeState() {
  runtime.api = null;
  runtime.handler = null;
  state.connected = false;
  state.ownId = null;
  state.account = null;
}

async function attachZalo(api, messageStore) {
  const ownId = api.getOwnId();
  const accountInfo = await api.fetchAccountInfo();

  runtime.api = api;
  state.connected = true;
  state.ownId = ownId;
  state.account = {
    userId: accountInfo.profile?.userId,
    displayName: accountInfo.profile?.displayName,
  };
  state.loginStatus = 'connected';
  state.loginError = null;
  logBuffer.push('info', 'Zalo connected', { ownId, displayName: state.account.displayName });

  runtime.handler = new MessageHandler({
    api,
    ownId,
    getSettings: async () => ({
      ...(state.settings || await loadSettings()),
      botDisplayName: state.account?.displayName || 'Bot'
    }),
    createAiBackend,
    conversations,
    messageStore,
  });

  api.listener.on('connected', () => {
    logger.info('Zalo websocket connected');
    logBuffer.push('info', 'Zalo websocket connected');
  });
  api.listener.on('disconnected', (code, reason) => {
    logger.warn({ code, reason }, 'Zalo websocket disconnected');
    logBuffer.push('warn', 'Zalo websocket disconnected', { code, reason });
  });
  api.listener.on('error', (error) => {
    logger.error({ err: error }, 'Zalo listener error');
    logBuffer.push('error', 'Zalo listener error', { message: error?.message || String(error) });
  });
  api.listener.on('message', async (message) => {
    try {
      const sender = message.data.dName || message.data.displayName || message.threadId;
      const text = message.data.content || '';
      console.log(`\x1b[36m[Chat]\x1b[0m \x1b[32m${sender}:\x1b[0m ${text}`);

      const result = await runtime.handler.handle(message);
      logger.info({ threadId: message.threadId, result }, 'Processed incoming message');
      logBuffer.push('info', 'Processed incoming message', { threadId: message.threadId, result });
    } catch (error) {
      logger.error({ err: error }, 'Failed to process incoming message');
      logBuffer.push('error', 'Failed to process incoming message', { message: error?.message || String(error) });
    }
  });

  api.listener.start({ retryOnClose: true });

  logger.info({ ownId, account: state.account, aiBackend: state.settings.aiBackend }, 'Zalo standalone bot is ready');
  logBuffer.push('info', 'Zalo standalone bot is ready', { ownId, aiBackend: state.settings.aiBackend });
}

async function connectAndAttachZalo(messageStore, { forceFresh = false } = {}) {
  if (forceFresh) {
    await clearSession();
    await clearQrPayload();
    qrState.set(null);
    logBuffer.push('info', 'Cleared saved Zalo session; next login will require QR');
  }

  state.loginStatus = 'connecting';
  state.loginError = null;
  logBuffer.push('info', 'Starting Zalo login flow', { transport: appConfig.zaloTransport, forceFresh });
  const api = appConfig.zaloTransport === 'mock' ? await connectMockZalo(qrState) : await connectZalo(qrState);
  await attachZalo(api, messageStore);
  return { connected: true, forceFresh };
}

async function disconnectZalo({ clearSavedSession = false } = {}) {
  if (runtime.api?.listener?.stop) {
    runtime.api.listener.stop();
  }
  resetRuntimeState();
  state.loginStatus = clearSavedSession ? 'logged_out' : 'disconnected';
  state.loginError = null;
  if (clearSavedSession) {
    await clearSession();
    await clearQrPayload();
    qrState.set(null);
  }
  logBuffer.push('info', 'Zalo runtime disconnected', { clearSavedSession });
  return { disconnected: true, clearSavedSession };
}

async function main() {
  const messageStore = await createMessageStore();
  state.settings = await loadSettings();
  logBuffer.push('info', 'App booting', { node: process.version, platform: process.platform, transport: appConfig.zaloTransport });
  if (!process.versions.node.startsWith('22.')) {
    logBuffer.push('warn', 'Node version is newer than recommended', { current: process.version, recommended: '22 LTS' });
  }

  let connectJob = null;

  async function startReconnect({ forceFresh = false } = {}) {
    if (connectJob) {
      return { started: false, inProgress: true };
    }

    await disconnectZalo({ clearSavedSession: false });
    connectJob = (async () => {
      try {
        await connectAndAttachZalo(messageStore, { forceFresh });
      } catch (error) {
        state.loginStatus = 'error';
        state.loginError = error?.message || String(error);
        logger.error({ err: error, forceFresh }, 'Background Zalo reconnect failed');
        logBuffer.push('error', 'Background Zalo reconnect failed', { message: state.loginError, forceFresh });
      } finally {
        connectJob = null;
      }
    })();

    return { started: true, forceFresh };
  }

  createHttpServer({
    state,
    conversations,
    messageStore,
    getSettings: async () => state.settings,
    updateSettings: async (patch) => {
      state.settings = await saveSettings(patch);
      return state.settings;
    },
    qrState,
    simulateMessage: async (payload) => {
      if (!runtime.handler || !state.ownId) {
        throw new Error('Zalo runtime chưa sẵn sàng');
      }
      const message = buildSimulatedMessage({ ...payload, ownId: state.ownId });
      return runtime.handler.handle(message);
    },
    manualReply: async ({ threadId, text, threadType = 'dm', attachments = [] }) => {
      if (!runtime.api || !state.ownId) throw new Error('Zalo chưa kết nối xong');
      if (!threadId) throw new Error('threadId là bắt buộc');
      
      const hasText = !!(text && text.trim());
      const hasAttachments = attachments.length > 0;
      
      if (!hasText && !hasAttachments) {
        throw new Error('Bạn phải nhập nội dung tin nhắn hoặc chọn tệp tin đính kèm');
      }

      const numericType = threadType === 'group' ? 1 : 0;
      const payload = { msg: text || '' };
      if (hasAttachments) {
        payload.attachments = attachments;
      }

      await runtime.api.sendMessage(payload, threadId, numericType);
      
      const displayText = text || `[Gửi ${attachments.length} tệp tin]`;
      
      await messageStore.saveMessage(
        makeMessageRecord({
          id: `manual-${threadId}-${Date.now()}`,
          threadId,
          threadType,
          direction: 'out',
          senderId: state.ownId,
          senderName: 'bot',
          text: displayText,
          raw: { manual: true, hasAttachments },
        }),
      );
      logBuffer.push('info', 'Manual reply sent', { threadId, threadType, hasAttachments });
      return { sent: true };
    },
    resolveName: async (uid) => {
      if (!runtime.api) return null;
      try {
        const info = await runtime.api.getUserInfo(uid);
        return info?.displayName || null;
      } catch (err) {
        return null;
      }
    },
    resolveGroupName: async (groupId) => {
      if (!runtime.api) return null;
      try {
        const response = await runtime.api.getGroupInfo(groupId);
        // Cấu trúc của zca-js: response.gridInfoMap[groupId].name
        const groupInfo = response?.gridInfoMap?.[groupId];
        return groupInfo?.name || null;
      } catch (err) {
        logger.debug({ err, groupId }, 'Failed to resolve group name from API');
        return null;
      }
    },
    logBuffer,
    disconnectZalo: async ({ clearSavedSession = false } = {}) => {
      await disconnectZalo({ clearSavedSession });
      if (clearSavedSession) {
        return startReconnect({ forceFresh: true });
      }
      return { disconnected: true, clearSavedSession };
    },
    reconnectZalo: async ({ forceFresh = false } = {}) => startReconnect({ forceFresh }),
  });

  logger.info({ port: appConfig.port }, 'Dashboard is available');
  logBuffer.push('info', 'Dashboard is available', { port: appConfig.port });

  try {
    await connectAndAttachZalo(messageStore);
  } catch (error) {
    state.loginStatus = 'error';
    state.loginError = error?.message || String(error);
    logger.error({ err: error }, 'Zalo login/bootstrap failed');
    logBuffer.push('error', 'Zalo login/bootstrap failed', { message: state.loginError });
  }
}

main().catch((error) => {
  logger.error({ err: error }, 'Fatal startup error');
  process.exitCode = 1;
});
