import OpenAI from 'openai';
import { logger } from '../logger.js';

export class ClientBackedAi {
  constructor({ apiKey, model, baseURL, systemPrompt }) {
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
      
      // Lấy lịch sử, BỎ QUA tin nhắn cuối cùng (vì tin nhắn cuối chính là câu lệnh hiện tại 'text')
      const fullHistory = memory.history || [];
      const previousMessages = fullHistory.slice(0, -1);

      const historyFormatted = previousMessages.map((item) => {
        const namePrefix = item.senderName ? `[${item.senderName}]: ` : '';
        return {
          role: item.role === 'assistant' ? 'assistant' : 'user',
          content: `${namePrefix}${item.text}`,
        };
      });

      const modelToUse = settings?.model || this.model;
      
      logger.debug({ model: modelToUse, historyLength: historyFormatted.length }, 'AI generating reply...');

      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...historyFormatted,
          {
            role: 'user',
            content: text, // Đây là câu lệnh thực tế: "tóm tắt nội dung..."
          },
        ],
      });

      const reply = response.choices?.[0]?.message?.content;
      return reply?.trim() || 'Dạ, bot chưa nghĩ ra câu trả lời phù hợp.';
    } catch (error) {
      logger.error({ err: error }, 'AI generateReply failed');
      if (error.status === 401) return '❌ Lỗi AI: Sai API Key hoặc chưa cấu hình key.';
      return `❌ Lỗi AI: ${error.message}`;
    }
  }
}
