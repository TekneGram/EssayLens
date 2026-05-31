import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Dispatch } from 'react';
import { toast } from 'react-toastify';
import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import { usePorts } from '@/app/ports';
import { useAppState } from '@/app/providers/state';
import type { AppState } from '@/app/providers/state/types';
import type { FeedbackItem } from '@/features/feedback/domain';
import { makeLocalId, toChatErrorMessage } from '../../domain/assessmentTab.logic';
import { handleChatStreamChunkWorkflow, submitChatMessageWorkflow } from '../../application/chatWorkflow.service';
import { submitCommentFeedbackWorkflow } from '@/features/comments-view';
import {
  addChatMessage,
  bumpSessionSyncForFile,
  selectActiveSessionIdForFile,
  setActiveSessionForFile,
  setChatError
} from '@/layout/ChatInterface/state';
import { createRubricFeedbackSessionId, resolveSessionIdForSend } from '@/layout/ChatInterface/domain';
import { selectIsModeLockedToChat } from '../../state';
import type { AssessmentTabAction, AssessmentTabLocalState } from '../../state';
import type { AppAction } from '@/app/providers/state/actions';
import type { AssessmentTabChatBindings } from '../../types';
import type { RubricPort } from '@/app/ports/rubric.port';

type AddFeedbackDraft = Omit<AddInlineFeedbackRequest, 'fileId'> | Omit<AddBlockFeedbackRequest, 'fileId'>;
const MAX_ESSAY_WORD_COUNT = 2000;
const ESSAY_TRUNCATION_WARNING = 'Only the first 2000 words of the essay are currently being considered.';

function toEssayForChat(rawEssayText: string | null): { essay?: string; wasTruncated: boolean } {
  if (!rawEssayText) {
    return { essay: undefined, wasTruncated: false };
  }

  const words = rawEssayText
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return { essay: undefined, wasTruncated: false };
  }

  // TODO: move this limit to configurable runtime/app settings.
  if (words.length <= MAX_ESSAY_WORD_COUNT) {
    return { essay: words.join(' '), wasTruncated: false };
  }

  return { essay: words.slice(0, MAX_ESSAY_WORD_COUNT).join(' '), wasTruncated: true };
}

async function resolveRubricIdForFile(args: {
  appState: AppState;
  rubricApi: RubricPort;
  selectedFileId: string;
}): Promise<string | null> {
  const { appState, rubricApi, selectedFileId } = args;
  const selectedFromState = appState.rubric.selectedGradingRubricIdByFileId[selectedFileId] ?? appState.rubric.lockedGradingRubricId;

  if (selectedFromState) {
    return selectedFromState;
  }

  const contextResult = await rubricApi.getGradingContext({ fileId: selectedFileId });
  if (!contextResult.ok) {
    throw new Error(contextResult.error.message || 'Unable to load rubric grading context.');
  }

  const rubricId = contextResult.data.selectedRubricIdForFile ?? contextResult.data.lockedRubricId ?? null;
  return rubricId;
}

interface UseAssessmentChatActionsParams {
  appDispatch: Dispatch<AppAction>;
  localState: AssessmentTabLocalState;
  localDispatch: Dispatch<AssessmentTabAction>;
  selectedFileId: string | null;
  selectedEssayText: string | null;
  addFeedback: (request: AddFeedbackDraft) => Promise<FeedbackItem>;
}

interface UseAssessmentChatActionsResult {
  handleModeChange: (mode: AssessmentTabChatBindings['chatMode']) => void;
  handleSubmit: () => Promise<void>;
  setDraftText: (text: string) => void;
  isModeLockedToChat: boolean;
  isChatSendDisabled: boolean;
}

export function useAssessmentChatActions({
  appDispatch,
  localState,
  localDispatch,
  selectedFileId,
  selectedEssayText,
  addFeedback
}: UseAssessmentChatActionsParams): UseAssessmentChatActionsResult {
  const { chat: chatApi, rubric: rubricApi, llmSession } = usePorts();
  const appState = useAppState();
  const { activeCommand, pendingSelection, chatMode, draftText } = localState;
  const isParagraphFeedbackBulkCommand = activeCommand?.id === 'paragraph-feedback-bulk';
  const workspaceDocxFileIds = useMemo(
    () => appState.workspace.files.filter((file) => file.kind === 'docx').map((file) => file.id),
    [appState.workspace.files]
  );
  const isModeLockedToChat = selectIsModeLockedToChat(localState);
  const activeSessionId = selectActiveSessionIdForFile(appState, selectedFileId);
  const resolvedSessionId = selectedFileId ? resolveSessionIdForSend(selectedFileId, activeSessionId) : undefined;
  const isChatSendDisabled = isParagraphFeedbackBulkCommand ? workspaceDocxFileIds.length === 0 : !selectedFileId;

  const streamMessageByClientRequestId = useRef(new Map<string, string>());
  const streamSeqByClientRequestId = useRef(new Map<string, number>());
  const streamSessionByClientRequestId = useRef(new Map<string, string>());
  const essaySentBySessionId = useRef(new Set<string>());

  const setDraftText = useCallback(
    (text: string) => {
      localDispatch({ type: 'assessmentTab/setDraftText', payload: text });
    },
    [localDispatch]
  );

  const handleModeChange = useCallback(
    (mode: AssessmentTabChatBindings['chatMode']) => {
      if (isModeLockedToChat && mode === 'comment') {
        return;
      }
      localDispatch({ type: 'assessmentTab/setChatMode', payload: mode });
    },
    [isModeLockedToChat, localDispatch]
  );

  const handleSubmit = useCallback(async () => {
    const message = draftText.trim();
    const isRubricFeedbackCommand = activeCommand?.id === 'evaluate-with-rubric';
    const isParagraphBulkCommand = activeCommand?.id === 'paragraph-feedback-bulk';

    if (chatMode === 'comment') {
      if (!message) {
        return;
      }
      try {
        await submitCommentFeedbackWorkflow({
          message,
          pendingSelection,
          addFeedback,
          onInlineSelectionCommitted: () => {
            localDispatch({ type: 'assessmentTab/setPendingSelection', payload: null });
          }
        });
        localDispatch({ type: 'assessmentTab/setDraftText', payload: '' });
      } catch {
        // Mutation hook is responsible for setting feedback error state + toast.
      }
      return;
    }

    if (!isRubricFeedbackCommand && !isParagraphBulkCommand && !message) {
      return;
    }

    if (!isParagraphBulkCommand && !selectedFileId) {
      const message = 'Select a file before sending chat messages.';
      appDispatch(setChatError(message));
      toast.error(message);
      return;
    }

    try {
      localDispatch({ type: 'assessmentTab/setDraftText', payload: '' });
      const preparedEssay = toEssayForChat(selectedEssayText);
      const essayForRubricFeedback = preparedEssay.essay;
      const essayForChat = resolvedSessionId && essaySentBySessionId.current.has(resolvedSessionId) ? undefined : preparedEssay.essay;
      if (isRubricFeedbackCommand && !essayForRubricFeedback) {
        const errorMessage = 'Select a file with essay text before sending rubric feedback.';
        appDispatch(setChatError(errorMessage));
        toast.error(errorMessage);
        return;
      }
      if (isParagraphBulkCommand) {
        if (workspaceDocxFileIds.length === 0) {
          const errorMessage = 'No DOCX files are available for paragraph feedback.';
          appDispatch(setChatError(errorMessage));
          toast.error(errorMessage);
          return;
        }

        await submitChatMessageWorkflow({
          chatApi,
          dispatch: appDispatch,
          kind: 'paragraph-feedback-bulk',
          selectedFileId,
          bulkFileIds: workspaceDocxFileIds,
          pendingSelection,
          streamMessageByClientRequestId: streamMessageByClientRequestId.current,
          streamSeqByClientRequestId: streamSeqByClientRequestId.current,
          streamSessionByClientRequestId: streamSessionByClientRequestId.current
        });
      } else if (isRubricFeedbackCommand) {
        if (!selectedFileId) {
          const errorMessage = 'Select a file before sending rubric feedback.';
          appDispatch(setChatError(errorMessage));
          toast.error(errorMessage);
          return;
        }

        const rubricSessionId = createRubricFeedbackSessionId(selectedFileId);
        const rubricId = await resolveRubricIdForFile({
          appState,
          rubricApi,
          selectedFileId
        });
        if (!rubricId) {
          const errorMessage = 'Select a rubric before sending rubric feedback.';
          appDispatch(setChatError(errorMessage));
          toast.error(errorMessage);
          return;
        }

        const createResult = await llmSession.create({ sessionId: rubricSessionId, fileEntityUuid: selectedFileId });
        if (!createResult.ok) {
          throw new Error(createResult.error.message || 'Unable to create rubric feedback session.');
        }

        appDispatch(setActiveSessionForFile({ fileId: selectedFileId, sessionId: rubricSessionId }));
        if (essayForRubricFeedback && preparedEssay.wasTruncated) {
          toast.warn(ESSAY_TRUNCATION_WARNING);
          appDispatch(
            addChatMessage({
              id: makeLocalId('system'),
              role: 'system',
              content: ESSAY_TRUNCATION_WARNING,
              relatedFileId: selectedFileId ?? undefined,
              sessionId: rubricSessionId,
              createdAt: new Date().toISOString()
            })
          );
        }

        await submitChatMessageWorkflow({
          chatApi,
          dispatch: appDispatch,
          kind: 'rubric-feedback',
          selectedFileId,
          activeSessionId: rubricSessionId,
          rubricId,
          message: undefined,
          essay: essayForRubricFeedback ?? '',
          pendingSelection,
          streamMessageByClientRequestId: streamMessageByClientRequestId.current,
          streamSeqByClientRequestId: streamSeqByClientRequestId.current,
          streamSessionByClientRequestId: streamSessionByClientRequestId.current
        });
      } else {
        if (!selectedFileId) {
          const errorMessage = 'Select a file before sending chat messages.';
          appDispatch(setChatError(errorMessage));
          toast.error(errorMessage);
          return;
        }

        if (resolvedSessionId) {
          appDispatch(setActiveSessionForFile({ fileId: selectedFileId, sessionId: resolvedSessionId }));
        }
        if (essayForChat && preparedEssay.wasTruncated) {
          toast.warn(ESSAY_TRUNCATION_WARNING);
          appDispatch(
            addChatMessage({
              id: makeLocalId('system'),
              role: 'system',
              content: ESSAY_TRUNCATION_WARNING,
              relatedFileId: selectedFileId ?? undefined,
              sessionId: resolvedSessionId,
              createdAt: new Date().toISOString()
            })
          );
        }
        await submitChatMessageWorkflow({
          chatApi,
          dispatch: appDispatch,
          message,
          essay: essayForChat,
          selectedFileId,
          activeSessionId: resolvedSessionId,
          pendingSelection,
          streamMessageByClientRequestId: streamMessageByClientRequestId.current,
          streamSeqByClientRequestId: streamSeqByClientRequestId.current,
          streamSessionByClientRequestId: streamSessionByClientRequestId.current
        });
      }

      const sessionIdForEssayTracking = isRubricFeedbackCommand || isParagraphBulkCommand ? undefined : resolvedSessionId;
      if (sessionIdForEssayTracking && essayForChat) {
        essaySentBySessionId.current.add(sessionIdForEssayTracking);
      }
      if (isParagraphBulkCommand) {
        workspaceDocxFileIds.forEach((fileId) => {
          appDispatch(bumpSessionSyncForFile({ fileId }));
        });
      } else if (selectedFileId) {
        appDispatch(bumpSessionSyncForFile({ fileId: selectedFileId }));
      }
    } catch (error) {
      const errorMessage = toChatErrorMessage(
        error,
        isRubricFeedbackCommand
          ? 'Unable to send rubric feedback.'
          : isParagraphBulkCommand
            ? 'Unable to send paragraph feedback in bulk.'
            : 'Unable to send chat message.'
      );
      toast.error(errorMessage);
    }
  }, [
    addFeedback,
    appDispatch,
    chatApi,
    chatMode,
    draftText,
    activeCommand,
    llmSession,
    localDispatch,
    pendingSelection,
    resolvedSessionId,
    selectedEssayText,
    selectedFileId,
    workspaceDocxFileIds,
    rubricApi,
    appState
  ]);

  useEffect(() => {
    if (typeof chatApi.onStreamChunk !== 'function') {
      return;
    }

    const unsubscribe = chatApi.onStreamChunk((event) => {
      if (event.workflow === 'paragraph-feedback-bulk' && event.type === 'start' && event.fileId) {
        appDispatch({
          type: 'workspace/setSelectedFile',
          payload: { fileId: event.fileId, status: 'ready' }
        });
      }
      if (event.workflow === 'paragraph-feedback-bulk' && event.fileId && event.sessionId) {
        appDispatch(setActiveSessionForFile({ fileId: event.fileId, sessionId: event.sessionId }));
      }
      handleChatStreamChunkWorkflow({
        event,
        dispatch: appDispatch,
        streamMessageByClientRequestId: streamMessageByClientRequestId.current,
        streamSeqByClientRequestId: streamSeqByClientRequestId.current,
        streamSessionByClientRequestId: streamSessionByClientRequestId.current
      });
    });

    return () => {
      unsubscribe();
    };
  }, [appDispatch, chatApi]);

  return {
    handleModeChange,
    handleSubmit,
    setDraftText,
    isModeLockedToChat,
    isChatSendDisabled
  };
}
