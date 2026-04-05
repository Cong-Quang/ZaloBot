export function buildSimulatedMessage({
  text = 'xin chào',
  threadId = 'test-thread',
  type = 0,
  ownId = 'bot-id',
  mentionOwnId = false,
}) {
  return {
    type,
    threadId,
    isSelf: false,
    data: {
      content: text,
      mentions: mentionOwnId
        ? [
            {
              uid: ownId,
              pos: 0,
              len: 4,
              type: 1,
            },
          ]
        : [],
      msgType: 'webchat',
      propertyExt: undefined,
      uidFrom: 'user-1',
      msgId: String(Date.now()),
      cliMsgId: String(Date.now()),
      ts: String(Date.now()),
      ttl: 0,
    },
  };
}
