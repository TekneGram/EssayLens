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
    const replyBubble = container.querySelector('li.msg.assistant:nth-of-type(2)');
    const actions = replyBubble?.querySelector('.msg-actions');
    const body = replyBubble?.querySelector('.msg-body');
    expect(actions).not.toBeNull();
    expect(body).not.toBeNull();
    expect(actions!.compareDocumentPosition(body!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getByRole('button', { name: 'Add to comments' }));
    expect(onCreateCommentFromChatMessage).toHaveBeenCalledWith('Final feedback.');
  });

  it('renders an inline-comment button for vocabulary bubbles and passes the payload', () => {
    const onCreateCommentFromChatMessage = vi.fn();
    const onCreateInlineCommentFromVocabulary = vi.fn();
    const vocabulary = { simpleVocabulary: 'good', textContext: 'It was good.', preciseVocabulary: 'exemplary' };

    render(
      <ChatScreen
        items={[
          {
            id: 'vocab-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content: "You used 'good' when you wrote 'It was good.'. You can improve this with: 'exemplary'.",
            canCreateComment: true,
            feedbackType: 'vocabulary',
            vocabulary
          }
        ]}
        isLoading={false}
        onCreateCommentFromChatMessage={onCreateCommentFromChatMessage}
        onCreateInlineCommentFromVocabulary={onCreateInlineCommentFromVocabulary}
      />
    );

    // Vocabulary bubbles get the inline button, not the generic "Add to comments" one.
    expect(screen.queryByRole('button', { name: 'Add to comments' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateInlineCommentFromVocabulary).toHaveBeenCalledWith(vocabulary);
    expect(onCreateCommentFromChatMessage).not.toHaveBeenCalled();
  });
});
