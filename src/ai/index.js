import { appConfig } from '../config.js';
import { MockAiBackend } from './mock-backend.js';
import { ClientBackedAi } from './client-backend.js';

export function createAiBackend(initialSettings) {
  const mode = initialSettings?.aiBackend || appConfig.aiBackend;

  // Helper để lấy key: Ưu tiên settings từ UI, nếu trống thì lấy từ appConfig (.env)
  const getApiKey = (uiKey, envKey) => {
    const key = uiKey || envKey;
    return (key && key.trim() !== '') ? key : undefined;
  };

  if (mode === 'openai') {
    return new ClientBackedAi({
      apiKey: getApiKey(initialSettings?.openaiApiKey, appConfig.openaiApiKey),
      model: initialSettings?.openaiModel || appConfig.openaiModel,
      systemPrompt: initialSettings?.systemPrompt || appConfig.openaiSystemPrompt,
    });
  }

  if (mode === 'openrouter') {
    return new ClientBackedAi({
      apiKey: getApiKey(initialSettings?.openrouterApiKey, appConfig.openrouterApiKey),
      baseURL: 'https://openrouter.ai/api/v1',
      model: initialSettings?.openrouterModel || appConfig.openrouterModel,
      systemPrompt: initialSettings?.systemPrompt || appConfig.openaiSystemPrompt,
    });
  }

  if (mode === 'ollama') {
    return new ClientBackedAi({
      apiKey: 'ollama',
      baseURL: `${initialSettings?.ollamaBaseUrl || appConfig.ollamaBaseUrl}/v1`,
      model: initialSettings?.ollamaModel || appConfig.ollamaModel,
      systemPrompt: initialSettings?.systemPrompt || appConfig.openaiSystemPrompt,
    });
  }

  if (mode === 'custom') {
    return new ClientBackedAi({
      apiKey: getApiKey(initialSettings?.customAiApiKey, appConfig.customAiApiKey) || 'custom',
      baseURL: initialSettings?.customAiBaseUrl || appConfig.customAiBaseUrl,
      model: initialSettings?.customAiModel || appConfig.customAiModel,
      systemPrompt: initialSettings?.systemPrompt || appConfig.openaiSystemPrompt,
    });
  }

  return new MockAiBackend();
}
