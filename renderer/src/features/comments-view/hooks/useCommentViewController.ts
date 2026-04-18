import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import type { CommentViewProps } from '@/features/assessment-tab/types';
import { createFallbackTitle, isCommentSelectKey } from '../domain/commentView.logic';

interface UseCommentViewControllerParams {
  comment: CommentViewProps['comment'];
  onSelectComment: CommentViewProps['onSelectComment'];
}

export function useCommentViewController({ comment, onSelectComment }: UseCommentViewControllerParams) {
  return useMemo(
    () => ({
      title: createFallbackTitle(comment.id, comment.kind),
      onSelect: () => onSelectComment(comment.id),
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target !== event.currentTarget || target.closest('button, textarea, input, select, option, a, [contenteditable="true"]'))
        ) {
          return;
        }

        if (!isCommentSelectKey(event.key)) {
          return;
        }
        event.preventDefault();
        onSelectComment(comment.id);
      }
    }),
    [comment.id, comment.kind, onSelectComment]
  );
}
