import OpenAI from 'openai';
import { logger } from '../logger.js';

export class ClientBackedAi {
  constructor({ apiKey, model, baseURL, systemPrompt }) {
    // Standard OpenAI or OpenAI-compatible backend (OpenRouter, Ollama, etc.)
    this.client = new OpenAI({ 
      apiKey: apiKey || 'missing-key', 
      baseURL: baseURL || undefined 
    });
    this.model = model;
    this.systemPrompt = systemPrompt;
  }

  async generateReply({ text, memory, threadType, settings }) {
    try {
      const systemPrompt = settings?.systemPrompt || this.systemPrompt;
      const history = (memory.history || []).slice(-10).map((item) => ({
        role: item.role === 'assistant' ? 'assistant' : 'user',
        content: item.text,
      }));

      const modelToUse = settings?.model || this.model;
      
      logger.debug({ model: modelToUse, historyLength: history.length }, 'AI generating reply...');

      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nNgữ cảnh: Bạn đang trả lời trong ${threadType === 'group' ? 'một nhóm chat Zalo' : 'một cuộc hội thoại riêng'}. Trả lời tự nhiên, ngắn gọn.`,
          },
          ...history,
          {
            role: 'user',
            content: text,
          },
        ],
      });

      const reply = response.choices?.[0]?.message?.content;
      return reply?.trim() || 'Dạ, bot chưa nghĩ ra câu trả lời phù hợp.';
    } catch (error) {
      logger.error({ err: error }, 'AI generateReply failed');
      // Return a user-friendly error message depending on the error type
      if (error.status === 401) return '❌ Lỗi AI: Sai API Key hoặc chưa cấu hình key trong Cài đặt.';
      if (error.status === 404) return `❌ Lỗi AI: Model "${settings?.model || this.model}" không tồn tại.`;
      return `❌ Lỗi AI: ${error.message}`;
    }
  }
}
