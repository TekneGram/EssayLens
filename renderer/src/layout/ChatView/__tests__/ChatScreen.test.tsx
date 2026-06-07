import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatScreen } from '@/layout/ChatView/components/ChatScreen';

describe('ChatScreen comment actions', () => {
  it('shows add comment only for completed assistant messages', () => {
    const onCreateCommentFromChatMessage = vi.fn();

    const { container } = render(
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
            canCreateComment: true,
            commentActionType: 'global'
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
    const replyBubble = container.querySelector('li.msg.assistant:nth-of-type(2)');
    const actions = replyBubble?.querySelector('.msg-actions');
    const body = replyBubble?.querySelector('.msg-body');
    expect(actions).not.toBeNull();
    expect(body).not.toBeNull();
    expect(actions!.compareDocumentPosition(body!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getByRole('button', { name: 'Add to comments' }));
    expect(onCreateCommentFromChatMessage).toHaveBeenCalledWith({
      type: 'global',
      text: 'Final feedback.',
      vocabularyItem: undefined
    });
  });

  it('shows inline comment label for inline vocabulary messages', () => {
    const onCreateCommentFromChatMessage = vi.fn();

    render(
      <ChatScreen
        items={[
          {
            id: 'reply-inline-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content:
              'You used good when you wrote a good plan. You can improve this with the following: effective',
            canCreateComment: true,
            commentActionType: 'inline',
            vocabularyItem: {
              simple_vocabulary: 'good',
              text_context: 'a good plan',
              precise_vocabulary: 'effective'
            }
          }
        ]}
        isLoading={false}
        onCreateCommentFromChatMessage={onCreateCommentFromChatMessage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateCommentFromChatMessage).toHaveBeenCalledWith({
      type: 'inline',
      text: 'You used good when you wrote a good plan. You can improve this with the following: effective',
      vocabularyItem: {
        simple_vocabulary: 'good',
        text_context: 'a good plan',
        precise_vocabulary: 'effective'
      }
    });
  });
});
