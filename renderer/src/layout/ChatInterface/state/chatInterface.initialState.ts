import type { ChatState } from '../domain';

export const initialChatState: ChatState = {
  messages: [],
  status: 'idle',
  activeSessionIdByFileId: {},
  sessionsByFileId: {},
  sessionsStatusByFileId: {},
  sessionsErrorByFileId: {},
  sessionSyncNonceByFileId: {},
  sessionSendPhaseBySessionId: {},
  bulkParagraphRun: {
    isActive: false,
    originFileId: null,
    currentFileId: null
  }
};
