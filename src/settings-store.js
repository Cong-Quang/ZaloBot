import fs from 'node:fs/promises';
import { appConfig } from './config.js';

const defaultSettings = {
  aiBackend: appConfig.aiBackend,
  openaiApiKey: appConfig.openaiApiKey,
  openaiModel: appConfig.openaiModel,
  openrouterApiKey: appConfig.openrouterApiKey,
  openrouterModel: appConfig.openrouterModel,
  ollamaModel: appConfig.ollamaModel,
  ollamaBaseUrl: appConfig.ollamaBaseUrl,
  customAiBaseUrl: appConfig.customAiBaseUrl,
  customAiApiKey: appConfig.customAiApiKey,
  customAiModel: appConfig.customAiModel,
  systemPrompt: appConfig.openaiSystemPrompt,
  zaloGroupRequireMention: appConfig.zaloGroupRequireMention,
  zaloFirstGreeting: appConfig.zaloFirstGreeting,
  zaloIntroHint: appConfig.zaloIntroHint,
  updatedAt: new Date().toISOString(),
};

export async function loadSettings() {
  try {
    const raw = await fs.readFile(appConfig.settingsPath, 'utf8');
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      const initial = { ...defaultSettings };
      await fs.writeFile(appConfig.settingsPath, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    throw error;
  }
}

export async function saveSettings(patch) {
  const current = await loadSettings().catch(() => ({ ...defaultSettings }));
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(appConfig.settingsPath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
