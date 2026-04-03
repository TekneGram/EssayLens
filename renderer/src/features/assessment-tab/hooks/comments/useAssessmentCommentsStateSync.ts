import { selectActiveCommentsTab } from '@/app/providers/state';
import type { AppState } from '@/app/providers/state/types';
import type { SelectedFileType } from '@/app/types';
import type { AssessmentTabLocalState } from '../../state';
import type { UseQueryResult } from '@tanstack/react-query';
import type { FeedbackItem } from '@/features/feedback/domain';

interface UseAssessmentCommentsStateSyncParams {
  appState: AppState;
  localState: AssessmentTabLocalState;
  feedbackListQuery: UseQueryResult<FeedbackItem[], Error>;
  selectedFileType: SelectedFileType;
  isAddFeedbackPending: boolean;
  addFeedbackErrorMessage?: string;
}

export function useAssessmentCommentsStateSync({
  appState,
  localState,
  feedbackListQuery,
  selectedFileType,
  isAddFeedbackPending,
  addFeedbackErrorMessage
}: UseAssessmentCommentsStateSyncParams) {
  const comments = feedbackListQuery.data ?? [];
  const canGenerateFeedbackDocument = selectedFileType === 'docx' && comments.length > 0;
  const activeCommentsTab = selectActiveCommentsTab(appState);
  const commentsError =
    feedbackListQuery.error instanceof Error
      ? feedbackListQuery.error.message
      : addFeedbackErrorMessage;

  return {
    comments,
    pendingSelection: localState.pendingSelection,
    activeCommentSelection: localState.activeCommentSelection,
    activeCommentId: localState.activeCommentId,
    activeCommentsTab,
    isCommentsLoading: feedbackListQuery.isPending || isAddFeedbackPending,
    canGenerateFeedbackDocument,
    commentsError: commentsError ?? undefined
  };
}
