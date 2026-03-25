import { describe, expect, it } from 'vitest';
import { initialAppState } from '@/app/providers/state';
import { collapseChatPanel, expandChatPanel, selectChatMessages, selectIsChatCollapsed, setChatCollapsed } from '@/layout/ChatView/state';

describe('chat-view state helpers', () => {
  it('creates collapse and expand actions', () => {
    expect(collapseChatPanel()).toEqual({ type: 'ui/setChatCollapsed', payload: true });
    expect(expandChatPanel()).toEqual({ type: 'ui/setChatCollapsed', payload: false });
    expect(setChatCollapsed(true)).toEqual({ type: 'ui/setChatCollapsed', payload: true });
  });

  it('selects chat messages and collapse status', () => {
    const state = {
      ...initialAppState,
      chat: {
        ...initialAppState.chat,
        messages: [
          {
            id: 'm-1',
            role: 'teacher' as const,
            content: 'Message',
            createdAt: '2026-02-20T00:00:00.000Z'
          }
        ]
      },
      ui: {
        ...initialAppState.ui,
        isChatCollapsed: true
      }
    };

    expect(selectChatMessages(state)).toHaveLength(1);
    expect(selectIsChatCollapsed(state)).toBe(true);
  });
});
