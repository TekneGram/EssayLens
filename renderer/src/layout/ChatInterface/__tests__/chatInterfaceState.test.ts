import { describe, expect, it } from 'vitest';
import { initialAppState } from '@/app/providers/state';
import {
  addChatMessage,
  bumpSessionSyncForFile,
  clearTransientSessionDrafts,
  selectActiveSessionIdForFile,
  selectChatError,
  selectSessionListErrorForFile,
  selectSessionListStatusForFile,
  selectSessionsForFile,
  selectChatStatus,
  setActiveSessionForFile,
  setChatError,
  setSessionListErrorForFile,
  setSessionListStatusForFile,
  setSessionTranscript,
  setSessionsForFile,
  setChatStatus,
  updateChatMessageContent
} from '@/layout/ChatInterface/state';

describe('chat-interface state helpers', () => {
  it('creates chat actions', () => {
    expect(setChatStatus('sending')).toEqual({ type: 'chat/setStatus', payload: 'sending' });
    expect(setChatError('Failed')).toEqual({ type: 'chat/setError', payload: 'Failed' });
    expect(
      updateChatMessageContent({
        messageId: 'a1',
        content: 'chunk',
        mode: 'append'
      })
    ).toEqual({
      type: 'chat/updateMessageContent',
      payload: { messageId: 'a1', content: 'chunk', mode: 'append' }
    });
    expect(
      addChatMessage({
        id: 'm-1',
        role: 'assistant',
        content: 'Reply',
        createdAt: '2026-02-20T00:00:00.000Z'
      })
    ).toEqual({
      type: 'chat/addMessage',
      payload: {
        id: 'm-1',
        role: 'assistant',
        content: 'Reply',
        createdAt: '2026-02-20T00:00:00.000Z'
      }
    });
    expect(setActiveSessionForFile({ fileId: 'file-1', sessionId: 'sess-1' })).toEqual({
      type: 'chat/setActiveSessionForFile',
      payload: { fileId: 'file-1', sessionId: 'sess-1' }
    });
    expect(
      setSessionsForFile({
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
      })
    ).toEqual({
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
    expect(setSessionListStatusForFile({ fileId: 'file-1', status: 'loading' })).toEqual({
      type: 'chat/setSessionListStatusForFile',
      payload: { fileId: 'file-1', status: 'loading' }
    });
    expect(setSessionListErrorForFile({ fileId: 'file-1', error: 'Failed' })).toEqual({
      type: 'chat/setSessionListErrorForFile',
      payload: { fileId: 'file-1', error: 'Failed' }
    });
    expect(
      setSessionTranscript({
        sessionId: 'sess-1',
        messages: [
          {
            id: 'm-1',
            role: 'assistant',
            content: 'Reply',
            relatedFileId: 'file-1',
            sessionId: 'sess-1',
            createdAt: '2026-02-20T00:00:00.000Z'
          }
        ]
      })
    ).toEqual({
      type: 'chat/setSessionTranscript',
      payload: {
        sessionId: 'sess-1',
        messages: [
          {
            id: 'm-1',
            role: 'assistant',
            content: 'Reply',
            relatedFileId: 'file-1',
            sessionId: 'sess-1',
            createdAt: '2026-02-20T00:00:00.000Z'
          }
        ]
      }
    });
    expect(clearTransientSessionDrafts({ sessionId: 'sess-1' })).toEqual({
      type: 'chat/clearTransientSessionDrafts',
      payload: { sessionId: 'sess-1' }
    });
    expect(bumpSessionSyncForFile({ fileId: 'file-1' })).toEqual({
      type: 'chat/bumpSessionSyncForFile',
      payload: { fileId: 'file-1' }
    });
  });

  it('selects chat status fields', () => {
    const state = {
      ...initialAppState,
      chat: {
        ...initialAppState.chat,
        status: 'error' as const,
        error: 'Request failed',
        activeSessionIdByFileId: {
          'file-1': 'sess-1'
        },
        sessionsByFileId: {
          'file-1': [
            {
              sessionId: 'sess-1',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-20T00:00:00.000Z',
              updatedAt: '2026-02-20T00:00:00.000Z',
              lastUsedAt: '2026-02-20T00:00:00.000Z'
            }
          ]
        },
        sessionsStatusByFileId: {
          'file-1': 'idle' as const
        },
        sessionsErrorByFileId: {
          'file-1': 'Could not load sessions'
        }
      }
    };

    expect(selectChatStatus(state)).toBe('error');
    expect(selectChatError(state)).toBe('Request failed');
    expect(selectActiveSessionIdForFile(state, 'file-1')).toBe('sess-1');
    expect(selectSessionsForFile(state, 'file-1')).toHaveLength(1);
    expect(selectSessionListStatusForFile(state, 'file-1')).toBe('idle');
    expect(selectSessionListErrorForFile(state, 'file-1')).toBe('Could not load sessions');
  });
});
