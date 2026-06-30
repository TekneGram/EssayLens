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
    const onCreateInlineCommentFromChatMessage = vi.fn();
    const vocabulary = { simpleVocabulary: 'good', textContext: 'It was good.', preciseVocabulary: 'exemplary' };
    const inlineComment = {
      searchText: 'It was good.',
      commentText: "Here you used the word 'good'. To improve, you could use: 'exemplary'."
    };

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
            vocabulary,
            inlineComment
          }
        ]}
        isLoading={false}
        onCreateCommentFromChatMessage={onCreateCommentFromChatMessage}
        onCreateInlineCommentFromChatMessage={onCreateInlineCommentFromChatMessage}
      />
    );

    // Vocabulary bubbles get the inline button, not the generic "Add to comments" one.
    expect(screen.queryByRole('button', { name: 'Add to comments' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateInlineCommentFromChatMessage).toHaveBeenCalledWith(inlineComment);
    expect(onCreateCommentFromChatMessage).not.toHaveBeenCalled();
  });

  it('renders an inline-comment button for thesis feedback bubbles', () => {
    const onCreateInlineCommentFromChatMessage = vi.fn();
    const inlineComment = {
      searchText: 'Students should read more books.',
      commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
    };

    render(
      <ChatScreen
        items={[
          {
            id: 'thesis-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content: '### Thesis Statement Feedback\nVerdict: Clear thesis, but it would be stronger with one concrete reason.',
            canCreateComment: false,
            feedbackType: 'thesis-statement-feedback',
            inlineComment
          }
        ]}
        isLoading={false}
        onCreateInlineCommentFromChatMessage={onCreateInlineCommentFromChatMessage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateInlineCommentFromChatMessage).toHaveBeenCalledWith(inlineComment);
  });

  it('renders an inline-comment button for paragraph evaluation bubbles', () => {
    const onCreateInlineCommentFromChatMessage = vi.fn();
    const inlineComment = {
      searchText: 'Body paragraph one.',
      commentText: 'The paragraph stays focused on the main idea.'
    };

    render(
      <ChatScreen
        items={[
          {
            id: 'paragraph-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content: '### Paragraph Evaluation 1\nComments: The paragraph stays focused on the main idea.',
            canCreateComment: false,
            feedbackType: 'paragraph-evaluation',
            inlineComment
          }
        ]}
        isLoading={false}
        onCreateInlineCommentFromChatMessage={onCreateInlineCommentFromChatMessage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateInlineCommentFromChatMessage).toHaveBeenCalledWith(inlineComment);
  });

  it('renders an inline-comment button for conclusion feedback bubbles', () => {
    const onCreateInlineCommentFromChatMessage = vi.fn();
    const inlineComment = {
      searchText: 'Conclusion paragraph. Final sentence here.',
      commentText: 'The final sentence ends with a clear and confident takeaway.'
    };

    render(
      <ChatScreen
        items={[
          {
            id: 'conclusion-1',
            roleClassName: 'assistant',
            roleLabel: 'Assistant',
            content:
              '### Conclusion Final Comment\nComments: The final sentence ends with a clear and confident takeaway.',
            canCreateComment: false,
            feedbackType: 'conclusion-final-comment',
            inlineComment
          }
        ]}
        isLoading={false}
        onCreateInlineCommentFromChatMessage={onCreateInlineCommentFromChatMessage}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add inline comment' }));
    expect(onCreateInlineCommentFromChatMessage).toHaveBeenCalledWith(inlineComment);
  });
});
