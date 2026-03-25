import { describe, expect, it } from 'vitest';
import { initialChatState } from '../initialState';
import { chatReducer } from '../reducers';

describe('chatReducer', () => {
  it('appends a message', () => {
    const next = chatReducer(initialChatState, {
      type: 'chat/addMessage',
      payload: {
        id: 'm1',
        role: 'assistant',
        content: 'Hello',
        createdAt: '2026-02-18T00:00:00.000Z'
      }
    });

    expect(next.messages).toHaveLength(1);
    expect(initialChatState.messages).toHaveLength(0);
  });

  it('sets status and error', () => {
    const sending = chatReducer(initialChatState, {
      type: 'chat/setStatus',
      payload: 'sending'
    });

    const withError = chatReducer(sending, {
      type: 'chat/setError',
      payload: 'Request failed'
    });

    expect(sending.status).toBe('sending');
    expect(withError.error).toBe('Request failed');
  });

  it('updates message content incrementally', () => {
    const seeded = chatReducer(initialChatState, {
      type: 'chat/addMessage',
      payload: {
        id: 'm1',
        role: 'assistant',
        content: '',
        createdAt: '2026-02-18T00:00:00.000Z'
      }
    });
    const appended = chatReducer(seeded, {
      type: 'chat/updateMessageContent',
      payload: {
        messageId: 'm1',
        content: 'Hel',
        mode: 'append'
      }
    });
    const replaced = chatReducer(appended, {
      type: 'chat/updateMessageContent',
      payload: {
        messageId: 'm1',
        content: 'Hello',
        mode: 'replace'
      }
    });

    expect(appended.messages[0]?.content).toBe('Hel');
    expect(replaced.messages[0]?.content).toBe('Hello');
  });

  it('stores session state by file id', () => {
    const withActiveSession = chatReducer(initialChatState, {
      type: 'chat/setActiveSessionForFile',
      payload: { fileId: 'file-1', sessionId: 'sess-1' }
    });
    const withSessionList = chatReducer(withActiveSession, {
      type: 'chat/setSessionsForFile',
      payload: {
        fileId: 'file-1',
        sessions: [
          {
            sessionId: 'sess-1',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-20T00:00:00.000Z',
            updatedAt: '2026-02-20T00:00:00.000Z',
            lastUsedAt: '2026-02-20T00:00:00.000Z'
          }
        ]
      }
    });
    const loadingSessions = chatReducer(withSessionList, {
      type: 'chat/setSessionListStatusForFile',
      payload: { fileId: 'file-1', status: 'loading' }
    });
    const withError = chatReducer(loadingSessions, {
      type: 'chat/setSessionListErrorForFile',
      payload: { fileId: 'file-1', error: 'Load failed' }
    });
    const synced = chatReducer(withError, {
      type: 'chat/bumpSessionSyncForFile',
      payload: { fileId: 'file-1' }
    });
    const clearedSession = chatReducer(withError, {
      type: 'chat/setActiveSessionForFile',
      payload: { fileId: 'file-1', sessionId: null }
    });

    expect(withActiveSession.activeSessionIdByFileId['file-1']).toBe('sess-1');
    expect(withSessionList.sessionsByFileId['file-1']).toHaveLength(1);
    expect(loadingSessions.sessionsStatusByFileId['file-1']).toBe('loading');
    expect(withError.sessionsErrorByFileId['file-1']).toBe('Load failed');
    expect(synced.sessionSyncNonceByFileId['file-1']).toBe(1);
    expect(clearedSession.activeSessionIdByFileId['file-1']).toBeUndefined();
  });

  it('replaces per-session transcript and clears transient assistant drafts', () => {
    const withTranscript = chatReducer(initialChatState, {
      type: 'chat/setSessionTranscript',
      payload: {
        sessionId: 'session-a',
        messages: [
          {
            id: 's-a-1',
            role: 'teacher',
            content: 'Hello',
            relatedFileId: 'file-1',
            sessionId: 'session-a',
            createdAt: '2026-02-18T00:00:00.000Z'
          },
          {
            id: 's-a-2',
            role: 'assistant',
            content: '',
            relatedFileId: 'file-1',
            sessionId: 'session-a',
            createdAt: '2026-02-18T00:00:00.000Z'
          }
        ]
      }
    });
    const withOtherSession = chatReducer(withTranscript, {
      type: 'chat/addMessage',
      payload: {
        id: 's-b-1',
        role: 'assistant',
        content: 'Other',
        relatedFileId: 'file-1',
        sessionId: 'session-b',
        createdAt: '2026-02-18T00:00:00.000Z'
      }
    });
    const refreshedTranscript = chatReducer(withOtherSession, {
      type: 'chat/setSessionTranscript',
      payload: {
        sessionId: 'session-a',
        messages: [
          {
            id: 's-a-3',
            role: 'assistant',
            content: 'Refreshed',
            relatedFileId: 'file-1',
            sessionId: 'session-a',
            createdAt: '2026-02-18T00:00:00.000Z'
          }
        ]
      }
    });
    const cleaned = chatReducer(refreshedTranscript, {
      type: 'chat/clearTransientSessionDrafts',
      payload: { sessionId: 'session-a' }
    });

    expect(refreshedTranscript.messages.some((m) => m.id === 's-a-1')).toBe(false);
    expect(refreshedTranscript.messages.some((m) => m.id === 's-a-3')).toBe(true);
    expect(refreshedTranscript.messages.some((m) => m.id === 's-b-1')).toBe(true);
    expect(cleaned.messages.some((m) => m.sessionId === 'session-a' && m.role === 'assistant' && m.content === '')).toBe(false);
  });
});
