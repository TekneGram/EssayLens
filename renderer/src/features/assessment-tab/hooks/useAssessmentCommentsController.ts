import { useAssessmentCommentsActions } from './comments/useAssessmentCommentsActions';
import { useAssessmentCommentsStateSync } from './comments/useAssessmentCommentsStateSync';
import { useFeedbackListQuery } from '@/features/comments-view';
import type { AssessmentTabAction, AssessmentTabLocalState } from '../state';
import type { AssessmentTabChatBindings } from '../types';
import type { AppState } from '@/app/providers/state/types';
import type { SelectedFileType } from '@/app/types';
import type { AppAction } from '@/app/providers/state/actions';
import type { Dispatch } from 'react';
import type { PendingSelection } from '@/layout/ChatInterface/domain';
import type { ChatInlineCommentPayload } from '@/app/ports/chat.port';
import type { FeedbackItem } from '@/features/feedback/domain';
import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { MutableRefObject } from 'react';
import type { WordTextMap } from '@/features/text-view-window';

type AddFeedbackDraft = Omit<AddInlineFeedbackRequest, 'fileId'> | Omit<AddBlockFeedbackRequest, 'fileId'>;

interface UseAssessmentCommentsControllerParams {
  appState: AppState;
  appDispatch: Dispatch<AppAction>;
  localState: AssessmentTabLocalState;
  localDispatch: Dispatch<AssessmentTabAction>;
  selectedFileId: string | null;
  selectedFileType: SelectedFileType;
  isAddFeedbackPending: boolean;
  addFeedbackErrorMessage?: string;
  addFeedback: (request: AddFeedbackDraft) => Promise<FeedbackItem>;
  setActiveCommandWithModeRule: (command: AssessmentTabChatBindings['activeCommand']) => void;
  textMapRef: MutableRefObject<WordTextMap | null>;
}

interface UseAssessmentCommentsControllerResult {
  comments: FeedbackItem[];
  pendingSelection: PendingSelection | null;
  activeCommentSelection: PendingSelection | null;
  activeCommentId: string | null;
  activeCommentsTab: import('@/app/providers/state').CommentsTab;
  isCommentsLoading: boolean;
  isGenerateFeedbackPending: boolean;
  canGenerateFeedbackDocument: boolean;
  commentsError?: string;
  onSelectionCaptured: (selection: PendingSelection | null) => void;
  onSelectComment: (commentId: string) => void;
  onEditComment: (commentId: string, nextText: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onApplyComment: (commentId: string, applied: boolean) => Promise<void>;
  onApplyAllComments: () => Promise<void>;
  onSendToLlm: (commentId: string, commandId?: string) => Promise<void>;
  onGenerateFeedbackDocument: () => Promise<void>;
  onCommentsTabChange: (tab: import('@/app/providers/state').CommentsTab) => void;
  onCreateCommentFromChatMessage: (text: string) => Promise<void>;
  onCreateInlineCommentFromChatMessage: (payload: ChatInlineCommentPayload) => Promise<void>;
}

export function useAssessmentCommentsController({
  appState,
  appDispatch,
  localState,
  localDispatch,
  selectedFileId,
  selectedFileType,
  isAddFeedbackPending,
  addFeedbackErrorMessage,
  addFeedback,
  setActiveCommandWithModeRule,
  textMapRef
}: UseAssessmentCommentsControllerParams): UseAssessmentCommentsControllerResult {
  const feedbackListQuery = useFeedbackListQuery(selectedFileId);

  const synced = useAssessmentCommentsStateSync({
    appState,
    localState,
    feedbackListQuery,
    selectedFileType,
    isAddFeedbackPending,
    addFeedbackErrorMessage
  });

  const actions = useAssessmentCommentsActions({
    appDispatch,
    localDispatch,
    selectedFileId,
    feedbackListQuery,
    comments: synced.comments,
    addFeedback,
    canGenerateFeedbackDocument: synced.canGenerateFeedbackDocument,
    setActiveCommandWithModeRule,
    textMapRef
  });

  return {
    ...synced,
    ...actions
  };
}
