export class MockAiBackend {
  async generateReply({ text, memory, threadType }) {
    const prefix = threadType === 'group' ? '[mock-group]' : '[mock-dm]';
    const previousTurns = memory.history.length;
    return `${prefix} Mình đã nhận: "${text}". Hiện đang chạy chế độ mock để test. Số lượt trong hội thoại: ${previousTurns}.`;
  }
}
