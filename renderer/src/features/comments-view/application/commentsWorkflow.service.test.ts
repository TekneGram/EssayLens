import { describe, expect, it, vi } from 'vitest';
import type { FeedbackItem } from '@/features/feedback/domain';
import { applyAllCommentsWorkflow } from './commentsWorkflow.service';

function createComment(id: string, applied: boolean): FeedbackItem {
  return {
    id,
    fileId: 'file-1',
    source: 'teacher',
    kind: 'block',
    commentText: `Comment ${id}`,
    createdAt: new Date('2026-02-19T12:00:00.000Z').toISOString(),
    applied
  };
}

describe('commentsWorkflow.service', () => {
  it('applies only unapplied comments and refetches once', async () => {
    const applyFeedback = vi.fn().mockResolvedValue(undefined);
    const refetchFeedback = vi.fn().mockResolvedValue(undefined);

    await applyAllCommentsWorkflow({
      comments: [createComment('feedback-1', false), createComment('feedback-2', true), createComment('feedback-3', false)],
      applyFeedback,
      refetchFeedback
    });

    expect(applyFeedback).toHaveBeenCalledTimes(2);
    expect(applyFeedback).toHaveBeenCalledWith({ feedbackId: 'feedback-1', applied: true });
    expect(applyFeedback).toHaveBeenCalledWith({ feedbackId: 'feedback-3', applied: true });
    expect(refetchFeedback).toHaveBeenCalledTimes(1);
  });
});
