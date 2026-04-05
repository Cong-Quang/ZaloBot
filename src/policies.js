import { appConfig } from './config.js';

export function isThreadAllowed(message) {
  const threadId = String(message.threadId || '');

  if (message.type === 0) {
    if (appConfig.dmBlocklist.has(threadId)) return false;
    if (appConfig.dmAllowlist.size > 0 && !appConfig.dmAllowlist.has(threadId)) return false;
    return true;
  }

  if (appConfig.groupBlocklist.has(threadId)) return false;
  if (appConfig.groupAllowlist.size > 0 && !appConfig.groupAllowlist.has(threadId)) return false;
  return true;
}

export function extractTextContent(message) {
  return typeof message?.data?.content === 'string' ? message.data.content.trim() : '';
}

export function shouldReplyInGroup(message, ownId, settings) {
  if (message.type !== 1) return true;
  if (!(settings?.zaloGroupRequireMention ?? appConfig.zaloGroupRequireMention)) return true;
  const mentions = Array.isArray(message?.data?.mentions) ? message.data.mentions : [];
  return mentions.some((mention) => String(mention.uid) === String(ownId));
}

export function shouldSendFirstGreeting(memory) {
  return memory.messageCount === 1;
}
