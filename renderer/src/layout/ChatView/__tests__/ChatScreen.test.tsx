import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '@/layout/ChatView/components/ChatScreen';

describe('ChatScreen comment actions', () => {
  it('shows add comment only for completed assistant messages', () => {
    const onCreateCommentFromChatMessage = vi.fn();

    render(
      <ChatScreen
        items={[
          {
            id: 'thinking-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content: 'Thinking through the prompt...',
            canCreateComment: false
          },
          {
            id: 'reply-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content: 'Final feedback.',
            canCreateComment: true
          },
          {
            id: 'teacher-1',
            roleClassName: 'teacher',
            roleLabel: 'Teacher',
            content: 'Please review this.',
            canCreateComment: false
          }
        ]}
        isLoading={false}
        onCreateCommentFromChatMessage={onCreateCommentFromChatMessage}
      />
    );

    expect(screen.getAllByRole('button', { name: 'Add to comments' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Add to comments' }));
    expect(onCreateCommentFromChatMessage).toHaveBeenCalledWith('Final feedback.');
  });
});
