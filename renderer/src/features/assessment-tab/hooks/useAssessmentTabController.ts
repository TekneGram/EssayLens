import { useCallback, useEffect, useReducer, useState } from 'react';
import { selectAssessmentSplitRatio, useAppDispatch, useAppState } from '@/app/providers/state';
import type { SelectedFileType } from '@/app/types';
import { toChatModeAfterCommandSelection } from '../domain/assessmentTab.logic';
import { useAddFeedbackMutation } from '@/features/comments-view';
import { useAssessmentChatController } from './useAssessmentChatController';
import { useAssessmentCommentsController } from './useAssessmentCommentsController';
import { assessmentTabReducer, initialAssessmentTabState } from '../state';
import type { AssessmentTabChatBindings } from '../types';

interface UseAssessmentTabControllerParams {
  selectedFileType: SelectedFileType;
  onChatBindingsChange?: (bindings: AssessmentTabChatBindings) => void;
}

export function useAssessmentTabController({
  selectedFileType,
  onChatBindingsChange
}: UseAssessmentTabControllerParams) {
  const appState = useAppState();
  const appDispatch = useAppDispatch();
  const [localState, localDispatch] = useReducer(assessmentTabReducer, initialAssessmentTabState);
  const [selectedEssayText, setSelectedEssayText] = useState<string | null>(null);

  const assessmentSplitRatio = selectAssessmentSplitRatio(appState);
  const selectedFile = appState.workspace.files.find((f: any) => f.id === appState.workspace.selectedFile?.fileId) ?? null;
  const selectedFileId = selectedFile?.id ?? null;

  useEffect(() => {
    setSelectedEssayText(null);
  }, [selectedFileId]);

  const { addFeedback, isPending: isAddFeedbackPending, errorMessage: addFeedbackErrorMessage } =
    useAddFeedbackMutation(selectedFileId);

  const setActiveCommandWithModeRule = useCallback(
    (command: AssessmentTabChatBindings['activeCommand']) => {
      localDispatch({ type: 'assessmentTab/setActiveCommand', payload: command });
      localDispatch({
        type: 'assessmentTab/setChatMode',
        payload: toChatModeAfterCommandSelection(localState.chatMode, command)
      });
    },
    [localState.chatMode]
  );

  const { chatMode, isModeLockedToChat } = useAssessmentChatController({
    appDispatch,
    localState,
    localDispatch,
    selectedFileId,
    selectedEssayText,
    addFeedback,
    onChatBindingsChange,
    setActiveCommandWithModeRule
  });

  const {
    comments,
    pendingSelection,
    activeCommentId,
    activeCommentsTab,
    isCommentsLoading,
    isGenerateFeedbackPending,
    canGenerateFeedbackDocument,
    commentsError,
    onSelectionCaptured,
    onSelectComment,
    onEditComment,
    onDeleteComment,
    onApplyComment,
    onSendToLlm,
    onGenerateFeedbackDocument,
    onCommentsTabChange
  } = useAssessmentCommentsController({
    appState,
    appDispatch,
    localState,
    localDispatch,
    selectedFileId,
    selectedFileType,
    isAddFeedbackPending,
    addFeedbackErrorMessage,
    setActiveCommandWithModeRule
  });

  const originalText =
    selectedFileType === 'docx' || selectedFileType === 'pdf'
      ? `OriginalTextView: ${selectedFile?.name ?? 'No file selected.'}`
      : 'OriginalTextView';

  const setSplitRatio = useCallback(
    (ratio: number) => {
      appDispatch({ type: 'ui/setAssessmentSplitRatio', payload: ratio });
    },
    [appDispatch]
  );

  return {
    selectedFileId,
    originalText,
    comments,
    pendingSelection,
    activeCommentId,
    chatMode,
    isModeLockedToChat,
    activeCommentsTab,
    assessmentSplitRatio,
    isCommentsLoading,
    isGenerateFeedbackPending,
    canGenerateFeedbackDocument,
    commentsError,
    onSelectionCaptured,
    onSelectComment,
    onEditComment,
    onDeleteComment,
    onApplyComment,
    onSendToLlm,
    onGenerateFeedbackDocument,
    onCommentsTabChange,
    onDocumentTextChange: setSelectedEssayText,
    setSplitRatio
  };
}
