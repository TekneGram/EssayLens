import { describe, expect, it } from 'vitest';
import { toChatViewMessageItems } from '@/layout/ChatView/application/chatView.service';

describe('chat-view application service', () => {
  it('maps chat messages to render-ready items', () => {
    const items = toChatViewMessageItems([
      {
        id: 'm1',
        role: 'teacher',
        content: 'How is this?',
        createdAt: '2026-02-24T00:00:00.000Z'
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'Looks good.',
        canCreateComment: false,
        createdAt: '2026-02-24T00:00:01.000Z'
      }
    ]);

    expect(items).toEqual([
      { id: 'm1', roleClassName: 'teacher', roleLabel: 'Teacher', content: 'How is this?', canCreateComment: false },
      { id: 'm2', roleClassName: 'assistant', roleLabel: 'Assistant', content: 'Looks good.', canCreateComment: false }
    ]);
  });

  it('defaults historical assistant messages to commentable', () => {
    const items = toChatViewMessageItems([
      {
        id: 'm1',
        role: 'assistant',
        content: 'Final persisted reply.',
        createdAt: '2026-02-24T00:00:00.000Z'
      }
    ]);

    expect(items[0].canCreateComment).toBe(true);
  });
});
