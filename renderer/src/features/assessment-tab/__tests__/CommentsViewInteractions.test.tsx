import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';
import type { FeedbackItem } from '../../feedback/domain';
import { CommentsView } from '@/features/comments-view';

function createLlmManagerApiMock() {
  return {
    listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    selectModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    updateSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    resetSettingsToDefaults: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    onDownloadProgress: vi.fn().mockReturnValue(() => {})
  };
}

function createInlineComment(): FeedbackItem {
  return {
    id: 'feedback-inline-1',
    fileId: '/workspace/essays/draft.docx',
    source: 'teacher',
    kind: 'inline',
    commentText: 'Clarify this sentence for precision.',
    exactQuote:
      'This is a much longer quote that should get truncated in the preview because it exceeds the component limit.',
    prefixText: 'Some prefix context',
    suffixText: 'Some suffix context',
    startAnchor: {
      part: 'renderer://original-text-view',
      paragraphIndex: 0,
      runIndex: 0,
      charOffset: 5
    },
    endAnchor: {
      part: 'renderer://original-text-view',
      paragraphIndex: 0,
      runIndex: 0,
      charOffset: 28
    },
    createdAt: new Date('2026-02-19T12:00:00.000Z').toISOString(),
    applied: false
  };
}

function createBlockComment(id: string, applied = false): FeedbackItem {
  return {
    id,
    fileId: '/workspace/essays/draft.docx',
    source: 'teacher',
    kind: 'block',
    commentText: `Block comment ${id}.`,
    createdAt: new Date('2026-02-19T12:00:00.000Z').toISOString(),
    applied
  };
}

describe('CommentsView interactions', () => {
  it('renders comment rows and emits tool actions', () => {
    const inlineComment = createInlineComment();
    const onSelectComment = vi.fn();
    const onEditComment = vi.fn();
    const onDeleteComment = vi.fn();
    const onSendToLlm = vi.fn();
    const onApplyComment = vi.fn();
    const onApplyAllComments = vi.fn();
    const onGenerateFeedbackDocument = vi.fn();

    const { container, rerender } = render(
      <CommentsView
        comments={[inlineComment]}
        activeCommentId={null}
        isLoading={false}
        isGeneratePending={false}
        canGenerateFeedbackDocument={true}
        onSelectComment={onSelectComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onSendToLlm={onSendToLlm}
        onApplyComment={onApplyComment}
        onApplyAllComments={onApplyAllComments}
        onGenerateFeedbackDocument={onGenerateFeedbackDocument}
        activeTab="comments"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Quote:')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Apply all' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Select Inline comment/i }));
    expect(onSelectComment).toHaveBeenCalledWith('feedback-inline-1');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.queryByText('Quote:')).toBeNull();
    expect(container.querySelector('.comment-body')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send to LLM' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Send command' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment text' }), {
      target: { value: 'Updated comment text from tools.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEditComment).toHaveBeenCalledWith('feedback-inline-1', 'Updated comment text from tools.');
    expect(screen.getByText('Quote:')).toBeTruthy();
    expect(container.querySelector('.comment-body')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Delete' })[0]).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send to LLM' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Send command' })).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(onDeleteComment).toHaveBeenCalledWith('feedback-inline-1');

    fireEvent.click(screen.getByRole('button', { name: 'Send to LLM' }));
    expect(onSendToLlm).toHaveBeenCalledWith('feedback-inline-1', undefined);

    fireEvent.change(screen.getByRole('combobox', { name: 'Send command' }), {
      target: { value: 'check-hedging' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send to LLM' }));
    expect(onSendToLlm).toHaveBeenCalledWith('feedback-inline-1', 'check-hedging');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApplyComment).toHaveBeenCalledWith('feedback-inline-1', true);

    expect(screen.queryByRole('button', { name: 'Create feedback document' })).toBeNull();
    rerender(
      <CommentsView
        comments={[inlineComment]}
        activeCommentId={null}
        isLoading={false}
        isGeneratePending={false}
        canGenerateFeedbackDocument={true}
        onSelectComment={onSelectComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onSendToLlm={onSendToLlm}
        onApplyComment={onApplyComment}
        onApplyAllComments={onApplyAllComments}
        onGenerateFeedbackDocument={onGenerateFeedbackDocument}
        activeTab="generate"
        onTabChange={vi.fn()}
      />
    );

    expect(screen.getByText('Generate Feedback')).toBeTruthy();
    expect(screen.getByText('Create a document that compiles the current comments into a shareable feedback draft.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create feedback document' }));
    expect(onGenerateFeedbackDocument).toHaveBeenCalledTimes(1);
  });

  it('shows apply all above multiple comments and disables it when all are applied', () => {
    const comments = [createInlineComment(), createBlockComment('feedback-block-1')];
    const onApplyAllComments = vi.fn();
    const props = {
      comments,
      activeCommentId: null,
      isLoading: false,
      isGeneratePending: false,
      canGenerateFeedbackDocument: true,
      onSelectComment: vi.fn(),
      onEditComment: vi.fn(),
      onDeleteComment: vi.fn(),
      onSendToLlm: vi.fn(),
      onApplyComment: vi.fn(),
      onApplyAllComments,
      onGenerateFeedbackDocument: vi.fn(),
      activeTab: 'comments' as const,
      onTabChange: vi.fn()
    };

    const { rerender } = render(<CommentsView {...props} />);

    const applyAllButton = screen.getByRole('button', { name: 'Apply all' });
    expect(applyAllButton).toBeTruthy();
    expect(applyAllButton.closest('.comments-list-actions')).toBeTruthy();

    fireEvent.click(applyAllButton);
    expect(onApplyAllComments).toHaveBeenCalledTimes(1);

    rerender(
      <CommentsView
        {...props}
        comments={[createInlineComment(), createBlockComment('feedback-block-1', true)].map((comment) => ({
          ...comment,
          applied: true
        }))}
      />
    );

    expect((screen.getByRole('button', { name: 'Apply all' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Unapply' })).toHaveLength(2);
  });

  it('focuses selected inline comments in OriginalTextView without showing pending comment UI', async () => {
    const selectFolder = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        folder: {
          id: '/workspace/essays',
          path: '/workspace/essays',
          name: 'essays'
        }
      }
    });
    const listFiles = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        files: [
          {
            id: '/workspace/essays/draft.docx',
            folderId: '/workspace/essays',
            name: 'draft.docx',
            path: '/workspace/essays/draft.docx',
            kind: 'docx'
          }
        ]
      }
    });
    const feedbackStore: FeedbackItem[] = [createInlineComment()];
    const listFeedback = vi.fn().mockImplementation(async () => ({
      ok: true,
      data: {
        feedback: feedbackStore
      }
    }));
    const addFeedback = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        feedback: {
          id: 'feedback-1',
          fileId: '/workspace/essays/draft.docx',
          source: 'teacher',
          kind: 'block',
          commentText: 'Nice work.',
          createdAt: new Date().toISOString()
        }
      }
    });
    const editFeedback = vi.fn().mockImplementation(async ({ feedbackId, commentText }: { feedbackId: string; commentText: string }) => {
      const index = feedbackStore.findIndex((item) => item.id === feedbackId);
      if (index >= 0) {
        feedbackStore[index] = {
          ...feedbackStore[index],
          commentText
        };
      }
      return { ok: true, data: { feedback: feedbackStore[index] } };
    });
    const applyFeedback = vi.fn().mockImplementation(async ({ feedbackId, applied }: { feedbackId: string; applied: boolean }) => {
      const index = feedbackStore.findIndex((item) => item.id === feedbackId);
      if (index >= 0) {
        feedbackStore[index] = {
          ...feedbackStore[index],
          applied
        };
      }
      return { ok: true, data: { feedback: feedbackStore[index] } };
    });
    const deleteFeedback = vi.fn().mockImplementation(async ({ feedbackId }: { feedbackId: string }) => {
      const index = feedbackStore.findIndex((item) => item.id === feedbackId);
      if (index >= 0) {
        feedbackStore.splice(index, 1);
      }
      return { ok: true, data: { deletedFeedbackId: feedbackId } };
    });
    const sendFeedbackToLlm = vi.fn().mockImplementation(async ({ feedbackId }: { feedbackId: string }) => {
      const source = feedbackStore.find((item) => item.id === feedbackId);
      if (source) {
        feedbackStore.push({
          ...source,
          id: 'feedback-inline-llm-1',
          source: 'llm',
          commentText: `LLM follow-up: ${source.commentText}`
        });
      }
      return { ok: true, data: { status: 'sent', messageId: 'msg-1' } };
    });

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback, addFeedback, editFeedback, applyFeedback, deleteFeedback, sendFeedbackToLlm },
        llmManager: createLlmManagerApiMock(),
        rubric: {},
        chat: {}
      },
      configurable: true
    });

    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'draft.docx' }));

    await waitFor(() => {
      expect(screen.getByText('Clarify this sentence for precision.')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Select Inline comment/i }));

    await waitFor(() => {
      expect(screen.queryByText('Pending Comment')).toBeNull();
      expect(screen.queryByTestId('highlighted-text-stub')).toBeNull();
      const focusedParagraph = screen.getByTestId('text-view-window').querySelector('.text-paragraph-focused');
      expect(focusedParagraph).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Edit comment text' }), {
      target: { value: 'Updated persisted comment text.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(editFeedback).toHaveBeenCalledWith({ feedbackId: 'feedback-inline-1', commentText: 'Updated persisted comment text.' });
    });
    await waitFor(() => {
      expect(listFeedback.mock.calls.length).toBeGreaterThan(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => {
      expect(applyFeedback).toHaveBeenCalledWith({ feedbackId: 'feedback-inline-1', applied: true });
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send to LLM' }));
    await waitFor(() => {
      expect(sendFeedbackToLlm).toHaveBeenCalledWith({ feedbackId: 'feedback-inline-1', command: undefined });
    });
    expect(listFeedback.mock.calls.length).toBeGreaterThan(2);

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    await waitFor(() => {
      expect(deleteFeedback).toHaveBeenCalledWith({ feedbackId: 'feedback-inline-1' });
    });
    expect(listFeedback.mock.calls.length).toBeGreaterThan(3);
  });
});
