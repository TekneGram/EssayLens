import type { AppState } from '@/app/providers/state';

export function selectChatStatus(state: AppState) {
  return state.chat.status;
}

export function selectChatError(state: AppState) {
  return state.chat.error;
}

export function selectActiveSessionIdForFile(state: AppState, fileId: string | null) {
  if (!fileId) {
    return undefined;
  }
  return state.chat.activeSessionIdByFileId[fileId];
}

export function selectSessionsForFile(state: AppState, fileId: string | null) {
  if (!fileId) {
    return [];
  }
  return state.chat.sessionsByFileId[fileId] ?? [];
}

export function selectSessionListStatusForFile(state: AppState, fileId: string | null) {
  if (!fileId) {
    return 'idle' as const;
  }
  return state.chat.sessionsStatusByFileId[fileId] ?? 'idle';
}

export function selectSessionListErrorForFile(state: AppState, fileId: string | null) {
  if (!fileId) {
    return undefined;
  }
  return state.chat.sessionsErrorByFileId[fileId];
}

export function selectSessionSyncNonceForFile(state: AppState, fileId: string | null) {
  if (!fileId) {
    return 0;
  }
  return state.chat.sessionSyncNonceByFileId[fileId] ?? 0;
}

export function selectSessionSendPhase(state: AppState, sessionId?: string) {
  if (!sessionId) {
    return undefined;
  }
  return state.chat.sessionSendPhaseBySessionId[sessionId];
}

export function selectBulkParagraphRun(state: AppState) {
  return state.chat.bulkParagraphRun;
}

export function selectSessionMessagesForFile(state: AppState, fileId: string | null, sessionId?: string) {
  if (!fileId || !sessionId) {
    return [];
  }
  return state.chat.messages.filter(
    (message) =>
      message.relatedFileId === fileId &&
      message.sessionId === sessionId &&
      (message.role === 'teacher' || message.role === 'assistant')
  );
}
