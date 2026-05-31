import { useMemo } from 'react';
import type { CommentsTab } from '@/app/providers/state';
import type { FeedbackItem } from '@/features/feedback/domain';
import {
  canApplyAllComments,
  canGenerateDocument,
  isCommentsTabActive,
  isGenerateTabActive,
  isScoreTabActive,
  shouldRenderCommentsList,
  shouldShowApplyAllCommentsButton,
  shouldShowEmptyCommentsState
} from '../domain/commentsView.logic';
import { toCommentsTab } from '../application/commentsView.service';

interface UseCommentsViewControllerParams {
  comments: FeedbackItem[];
  isLoading: boolean;
  error?: string;
  isGeneratePending: boolean;
  canGenerateFeedbackDocument: boolean;
  activeTab: CommentsTab;
  onTabChange: (tab: CommentsTab) => void;
}

export function useCommentsViewController({
  comments,
  isLoading,
  error,
  isGeneratePending,
  canGenerateFeedbackDocument,
  activeTab,
  onTabChange
}: UseCommentsViewControllerParams) {
  return useMemo(
    () => ({
      isCommentsActive: isCommentsTabActive(activeTab),
      isScoreActive: isScoreTabActive(activeTab),
      isGenerateActive: isGenerateTabActive(activeTab),
      isGenerateEnabled: canGenerateDocument(canGenerateFeedbackDocument, isGeneratePending),
      showEmptyState: shouldShowEmptyCommentsState({ isLoading, error, comments }),
      showCommentsList: shouldRenderCommentsList(comments),
      showApplyAllButton: shouldShowApplyAllCommentsButton(comments),
      canApplyAllComments: canApplyAllComments(comments),
      onSelectCommentsTab: () => onTabChange(toCommentsTab('comments')),
      onSelectScoreTab: () => onTabChange(toCommentsTab('score')),
      onSelectGenerateTab: () => onTabChange(toCommentsTab('generate'))
    }),
    [activeTab, canGenerateFeedbackDocument, comments, error, isGeneratePending, isLoading, onTabChange]
  );
}
