import OpenAI from 'openai';
import { appConfig } from '../config.js';

export class OpenAiBackend {
  constructor() {
    if (!appConfig.openaiApiKey) {
      throw new Error('OPENAI_API_KEY is missing while AI_BACKEND=openai');
    }
    this.client = new OpenAI({ apiKey: appConfig.openaiApiKey });
  }

  async generateReply({ text, memory, threadType }) {
    const history = memory.history.slice(-10).map((item) => ({
      role: item.role,
      content: item.text,
    }));

    const response = await this.client.responses.create({
      model: appConfig.openaiModel,
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: `${appConfig.openaiSystemPrompt}\nNgữ cảnh cuộc trò chuyện: ${threadType === 'group' ? 'nhóm' : 'nhắn riêng'}.`,
            },
          ],
        },
        ...history.map((item) => ({
          role: item.role,
          content: [{ type: 'input_text', text: item.content }],
        })),
        {
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      ],
    });

    return response.output_text?.trim() || 'Mình đang bị trống phản hồi, Quang thử nhắn lại giúp mình nhé.';
  }
}
