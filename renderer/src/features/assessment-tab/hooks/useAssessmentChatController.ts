import { useAssessmentChatActions } from './chat/useAssessmentChatActions';
import { useAssessmentChatStateSync } from './chat/useAssessmentChatStateSync';
import type { FeedbackItem } from '../../feedback/domain';
import type { EssayFeedbackSelectionState } from '@/features/essay-feedback-manager/essayFeedbackManager.types';
import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { AssessmentTabAction, AssessmentTabLocalState } from '../state';
import type { AssessmentTabChatBindings } from '../types';
import type { AppAction } from '@/app/providers/state/actions';
import type { Dispatch } from 'react';

type AddFeedbackDraft = Omit<AddInlineFeedbackRequest, 'fileId'> | Omit<AddBlockFeedbackRequest, 'fileId'>;

interface UseAssessmentChatControllerParams {
  appDispatch: Dispatch<AppAction>;
  localState: AssessmentTabLocalState;
  localDispatch: Dispatch<AssessmentTabAction>;
  selectedFileId: string | null;
  selectedEssayText: string | null;
  essayFeedbackSelection: EssayFeedbackSelectionState;
  addFeedback: (request: AddFeedbackDraft) => Promise<FeedbackItem>;
  onChatBindingsChange?: (bindings: AssessmentTabChatBindings) => void;
  setActiveCommandWithModeRule: (command: AssessmentTabChatBindings['activeCommand']) => void;
  onCreateCommentFromChatMessage?: AssessmentTabChatBindings['onCreateCommentFromChatMessage'];
  onCreateInlineCommentFromChatMessage?: AssessmentTabChatBindings['onCreateInlineCommentFromChatMessage'];
}

interface UseAssessmentChatControllerResult {
  chatMode: AssessmentTabChatBindings['chatMode'];
  isModeLockedToChat: boolean;
  isChatSendDisabled: boolean;
}

export function useAssessmentChatController({
  appDispatch,
  localState,
  localDispatch,
  selectedFileId,
  selectedEssayText,
  essayFeedbackSelection,
  addFeedback,
  onChatBindingsChange,
  setActiveCommandWithModeRule,
  onCreateCommentFromChatMessage,
  onCreateInlineCommentFromChatMessage
}: UseAssessmentChatControllerParams): UseAssessmentChatControllerResult {
  const { handleModeChange, handleSubmit, setDraftText, isModeLockedToChat, isChatSendDisabled } = useAssessmentChatActions({
    appDispatch,
    localState,
    localDispatch,
    selectedFileId,
    selectedEssayText,
    essayFeedbackSelection,
    addFeedback
  });

  useAssessmentChatStateSync({
    localState,
    isModeLockedToChat,
    isChatSendDisabled,
    setDraftText,
    handleSubmit,
    handleModeChange,
    setActiveCommandWithModeRule,
    onCreateCommentFromChatMessage,
    onCreateInlineCommentFromChatMessage,
    onChatBindingsChange
  });

  return {
    chatMode: localState.chatMode,
    isModeLockedToChat,
    isChatSendDisabled
  };
}
