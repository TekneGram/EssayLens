import { useCallback, useEffect, useRef } from 'react';
import type { Dispatch } from 'react';
import { toast } from 'react-toastify';
import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import { usePorts } from '@/app/ports';
import { useAppState } from '@/app/providers/state';
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
import { resolveSessionIdForSend } from '@/layout/ChatInterface/domain';
import { selectIsModeLockedToChat } from '../../state';
import type { AssessmentTabAction, AssessmentTabLocalState } from '../../state';
import type { AppAction } from '@/app/providers/state/actions';
import type { AssessmentTabChatBindings } from '../../types';

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
  const { chat: chatApi } = usePorts();
  const appState = useAppState();
  const { pendingSelection, chatMode, draftText } = localState;
  const isModeLockedToChat = selectIsModeLockedToChat(localState);
  const activeSessionId = selectActiveSessionIdForFile(appState, selectedFileId);
  const resolvedSessionId = selectedFileId ? resolveSessionIdForSend(selectedFileId, activeSessionId) : undefined;
  const isChatSendDisabled = !selectedFileId;

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
    if (!message) {
      return;
    }

    if (chatMode === 'comment') {
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

    if (!selectedFileId) {
      const message = 'Select a file before sending chat messages.';
      appDispatch(setChatError(message));
      toast.error(message);
      return;
    }

    try {
      localDispatch({ type: 'assessmentTab/setDraftText', payload: '' });
      if (resolvedSessionId) {
        appDispatch(setActiveSessionForFile({ fileId: selectedFileId, sessionId: resolvedSessionId }));
      }
      const preparedEssay = toEssayForChat(selectedEssayText);
      const essay = resolvedSessionId && essaySentBySessionId.current.has(resolvedSessionId) ? undefined : preparedEssay.essay;
      if (essay && preparedEssay.wasTruncated) {
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
        essay,
        selectedFileId,
        activeSessionId: resolvedSessionId,
        pendingSelection,
        streamMessageByClientRequestId: streamMessageByClientRequestId.current,
        streamSeqByClientRequestId: streamSeqByClientRequestId.current,
        streamSessionByClientRequestId: streamSessionByClientRequestId.current
      });
      if (resolvedSessionId && essay) {
        essaySentBySessionId.current.add(resolvedSessionId);
      }
      appDispatch(bumpSessionSyncForFile({ fileId: selectedFileId }));
    } catch (error) {
      const errorMessage = toChatErrorMessage(error, 'Unable to send chat message.');
      toast.error(errorMessage);
    }
  }, [
    addFeedback,
    appDispatch,
    chatApi,
    chatMode,
    draftText,
    localDispatch,
    pendingSelection,
    resolvedSessionId,
    selectedEssayText,
    selectedFileId
  ]);

  useEffect(() => {
    if (typeof chatApi.onStreamChunk !== 'function') {
      return;
    }

    const unsubscribe = chatApi.onStreamChunk((event) => {
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
