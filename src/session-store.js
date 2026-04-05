import fs from 'node:fs/promises';
import { appConfig } from './config.js';

async function writeJsonAtomic(filePath, value) {
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tempPath, filePath);
}

export async function loadSession() {
  try {
    const raw = await fs.readFile(appConfig.sessionPath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return {
      imei: data.imei || '',
      userAgent: data.userAgent || '',
      language: data.language || 'vi',
      cookie: Array.isArray(data.cookie) ? data.cookie : data.cookie?.cookies || [],
      account: data.account || null,
      savedAt: data.savedAt || null,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveSession(session) {
  const normalized = {
    imei: session?.imei || '',
    userAgent: session?.userAgent || '',
    language: session?.language || 'vi',
    cookie: Array.isArray(session?.cookie) ? session.cookie : session?.cookie?.cookies || [],
    account: session?.account || null,
    savedAt: session?.savedAt || new Date().toISOString(),
  };
  await writeJsonAtomic(appConfig.sessionPath, normalized);
}

export async function saveQrPayload(payload) {
  await writeJsonAtomic(appConfig.qrPath, payload);
}

export async function loadQrPayload() {
  try {
    const raw = await fs.readFile(appConfig.qrPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function clearSession() {
  await fs.rm(appConfig.sessionPath, { force: true });
}

export async function clearQrPayload() {
  await fs.rm(appConfig.qrPath, { force: true });
}
