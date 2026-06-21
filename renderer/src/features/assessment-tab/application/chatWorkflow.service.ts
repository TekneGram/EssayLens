import type { Dispatch } from 'react';
import type { ChatStreamChunkEvent } from '@/app/ports/chat.port';
import type { EssayFeedbackType } from '@/app/ports/chat.port';
import {
  addChatMessage,
  removeChatMessage,
  setChatMessageCommentable,
  setChatError,
  setChatStatus,
  setSessionSendPhase,
  updateChatMessageContent
} from '@/layout/ChatInterface/state';
import type { PendingSelection } from '@/layout/ChatInterface/domain';
import type { AppAction } from '@/app/providers/state/actions';
import type { ChatPort } from '@/app/ports';
import {
  isContentStreamChunk,
  isNewerStreamSeq,
  makeLocalId,
  toChatErrorMessage
} from '../domain/assessmentTab.logic';

interface SubmitChatMessageWorkflowParams {
  chatApi: ChatPort;
  dispatch: Dispatch<AppAction>;
  kind?: 'chat' | 'rubric-feedback' | 'paragraph-feedback-bulk' | 'essay-feedback';
  message?: string;
  essay?: string;
  rubricId?: string;
  bulkFileIds?: string[];
  redoCompletedFileIds?: string[];
  essayFeedbackTypes?: EssayFeedbackType[];
  selectedFileId: string | null;
  activeSessionId?: string;
  pendingSelection: PendingSelection | null;
  streamMessageByClientRequestId: Map<string, string>;
  streamSeqByClientRequestId: Map<string, number>;
  streamSessionByClientRequestId: Map<string, string>;
}

export async function submitChatMessageWorkflow({
  chatApi,
  dispatch,
  kind = 'chat',
  message,
  essay,
  rubricId,
  bulkFileIds,
  redoCompletedFileIds,
  essayFeedbackTypes,
  selectedFileId,
  activeSessionId,
  pendingSelection,
  streamMessageByClientRequestId,
  streamSeqByClientRequestId,
  streamSessionByClientRequestId
}: SubmitChatMessageWorkflowParams): Promise<void> {
  const clientRequestId =
    kind === 'rubric-feedback'
      ? makeLocalId('rubricreq')
      : kind === 'paragraph-feedback-bulk'
        ? makeLocalId('paragraphbulkreq')
        : kind === 'essay-feedback'
          ? makeLocalId('essayfeedbackreq')
        : makeLocalId('chatreq');
  const createdAt = new Date().toISOString();

  if (kind === 'chat') {
    dispatch(
      addChatMessage({
        id: makeLocalId('teacher'),
        role: 'teacher',
        content: message ?? '',
        relatedFileId: selectedFileId ?? undefined,
        sessionId: activeSessionId,
        createdAt
      })
    );
  }

  let assistantMessageId: string | undefined;
  if (kind === 'chat') {
    assistantMessageId = makeLocalId('assistant');
    streamMessageByClientRequestId.set(clientRequestId, assistantMessageId);
    streamSeqByClientRequestId.set(clientRequestId, -1);
    if (activeSessionId) {
      streamSessionByClientRequestId.set(clientRequestId, activeSessionId);
    }
    dispatch(
      addChatMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        relatedFileId: selectedFileId ?? undefined,
        sessionId: activeSessionId,
        createdAt,
        canCreateComment: false
      })
    );
  }

  dispatch(setChatStatus('sending'));
  dispatch(setChatError(undefined));
  if (activeSessionId) {
    dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: 'warming' }));
  }

  try {
    const request = {
      kind,
      fileId: selectedFileId ?? undefined,
      sessionId: activeSessionId,
      clientRequestId
    } as {
      kind: 'chat' | 'rubric-feedback' | 'paragraph-feedback-bulk' | 'essay-feedback';
      fileId?: string;
      fileIds?: string[];
      redoCompletedFileIds?: string[];
      selectedFeedbackTypes?: EssayFeedbackType[];
      sessionId?: string;
      clientRequestId: string;
      message?: string;
      essay?: string;
      rubricId?: string;
      contextText?: string;
    };
    if (typeof message === 'string') {
      request.message = message;
    }
    if (typeof essay === 'string') {
      request.essay = essay;
    }
    if (typeof rubricId === 'string') {
      request.rubricId = rubricId;
    }
    if (kind === 'paragraph-feedback-bulk' && bulkFileIds && bulkFileIds.length > 0) {
      request.fileIds = bulkFileIds;
    }
    if (kind === 'paragraph-feedback-bulk' && redoCompletedFileIds && redoCompletedFileIds.length > 0) {
      request.redoCompletedFileIds = redoCompletedFileIds;
    }
    if (kind === 'essay-feedback' && essayFeedbackTypes && essayFeedbackTypes.length > 0) {
      request.selectedFeedbackTypes = essayFeedbackTypes;
    }
    if (typeof pendingSelection?.exactQuote === 'string') {
      request.contextText = pendingSelection.exactQuote;
    }

    const result = await chatApi.sendMessage(request);
    if (!result.ok) {
      throw new Error(result.error.message || 'Unable to send chat message.');
    }

    if (kind === 'chat' && assistantMessageId) {
      dispatch(
        updateChatMessageContent({
          messageId: assistantMessageId,
          content: result.data.reply,
          mode: 'replace'
        })
      );
      dispatch(setChatMessageCommentable({ messageId: assistantMessageId, canCreateComment: true }));
      streamMessageByClientRequestId.delete(clientRequestId);
      streamSeqByClientRequestId.delete(clientRequestId);
      streamSessionByClientRequestId.delete(clientRequestId);
    } else if (kind === 'rubric-feedback') {
      for (const reply of result.data.rubricFeedback?.replies ?? []) {
        const responseMessageId = reply.messageId;
        const createdAt = new Date().toISOString();
        if (!streamMessageByClientRequestId.has(reply.clientRequestId)) {
          dispatch(
            addChatMessage({
              id: responseMessageId,
              role: 'assistant',
              content: reply.reply,
              relatedFileId: selectedFileId ?? undefined,
              sessionId: activeSessionId,
              createdAt,
              canCreateComment: true
            })
          );
          continue;
        }

        dispatch(
          updateChatMessageContent({
            messageId: responseMessageId,
            content: reply.reply,
            mode: 'replace'
          })
        );
        dispatch(setChatMessageCommentable({ messageId: responseMessageId, canCreateComment: true }));

        streamMessageByClientRequestId.delete(reply.clientRequestId);
        streamSeqByClientRequestId.delete(reply.clientRequestId);
        streamSessionByClientRequestId.delete(reply.clientRequestId);
      }
    } else if (kind === 'paragraph-feedback-bulk') {
      for (const reply of result.data.paragraphFeedbackBulk?.replies ?? []) {
        const responseMessageId = reply.messageId;
        const responseSessionId = reply.sessionId;
        const createdAt = new Date().toISOString();
        if (reply.progressMessageId) {
          dispatch(removeChatMessage({ messageId: reply.progressMessageId }));
        }
        if (!streamMessageByClientRequestId.has(reply.clientRequestId)) {
          dispatch(
            addChatMessage({
              id: responseMessageId,
              role: 'assistant',
              content: reply.reply,
              relatedFileId: reply.fileId,
              sessionId: responseSessionId,
              createdAt,
              canCreateComment: !reply.diagnosticType
            })
          );
        } else {
          dispatch(
            updateChatMessageContent({
              messageId: responseMessageId,
              content: reply.reply,
              mode: 'replace'
            })
          );
          dispatch(setChatMessageCommentable({ messageId: responseMessageId, canCreateComment: !reply.diagnosticType }));
        }

        streamMessageByClientRequestId.delete(reply.clientRequestId);
        streamSeqByClientRequestId.delete(reply.clientRequestId);
        streamSessionByClientRequestId.delete(reply.clientRequestId);
      }

      for (const failure of result.data.paragraphFeedbackBulk?.failures ?? []) {
        const createdAt = new Date().toISOString();
        const existingMessageId = streamMessageByClientRequestId.get(failure.clientRequestId);
        const failureContent = formatParagraphFeedbackBulkFailure(failure.reason, failure.details);

        if (existingMessageId) {
          dispatch(
            updateChatMessageContent({
              messageId: existingMessageId,
              content: failureContent,
              mode: 'replace'
            })
          );
        } else {
          dispatch(
            addChatMessage({
              id: failure.messageId,
              role: 'assistant',
              content: failureContent,
              relatedFileId: failure.fileId,
              sessionId: failure.sessionId,
              createdAt,
              canCreateComment: false
            })
          );
        }

        streamMessageByClientRequestId.delete(failure.clientRequestId);
        streamSeqByClientRequestId.delete(failure.clientRequestId);
        streamSessionByClientRequestId.delete(failure.clientRequestId);
      }
    } else if (kind === 'essay-feedback') {
      for (const reply of result.data.essayFeedback?.replies ?? []) {
        const createdAt = new Date().toISOString();
        const existingMessageId = streamMessageByClientRequestId.get(reply.clientRequestId);

        if (existingMessageId) {
          dispatch(
            updateChatMessageContent({
              messageId: existingMessageId,
              content: reply.reply,
              mode: 'replace'
            })
          );
        } else {
          dispatch(
            addChatMessage({
              id: reply.messageId,
              role: 'assistant',
              content: reply.reply,
              relatedFileId: reply.fileId,
              sessionId: reply.sessionId,
              createdAt,
              canCreateComment: false
            })
          );
        }

        streamMessageByClientRequestId.delete(reply.clientRequestId);
        streamSeqByClientRequestId.delete(reply.clientRequestId);
        streamSessionByClientRequestId.delete(reply.clientRequestId);
      }

      for (const failure of result.data.essayFeedback?.failures ?? []) {
        const createdAt = new Date().toISOString();
        const existingMessageId = streamMessageByClientRequestId.get(failure.clientRequestId);
        const failureContent = formatParagraphFeedbackBulkFailure(failure.reason, failure.details);

        if (existingMessageId) {
          dispatch(
            updateChatMessageContent({
              messageId: existingMessageId,
              content: failureContent,
              mode: 'replace'
            })
          );
        } else {
          dispatch(
            addChatMessage({
              id: failure.messageId,
              role: 'assistant',
              content: failureContent,
              relatedFileId: failure.fileId,
              sessionId: failure.sessionId,
              createdAt,
              canCreateComment: false
            })
          );
        }

        streamMessageByClientRequestId.delete(failure.clientRequestId);
        streamSeqByClientRequestId.delete(failure.clientRequestId);
        streamSessionByClientRequestId.delete(failure.clientRequestId);
      }
    }
    if (streamMessageByClientRequestId.size === 0) {
      dispatch(setChatStatus('idle'));
    }
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
  } catch (error) {
    if (kind === 'rubric-feedback' || kind === 'paragraph-feedback-bulk' || kind === 'essay-feedback') {
      streamMessageByClientRequestId.clear();
      streamSeqByClientRequestId.clear();
      streamSessionByClientRequestId.clear();
    } else {
      streamMessageByClientRequestId.delete(clientRequestId);
      streamSeqByClientRequestId.delete(clientRequestId);
      streamSessionByClientRequestId.delete(clientRequestId);
    }
    const errorMessage = toChatErrorMessage(error, 'Unable to send chat message.');
    dispatch(setChatStatus('error'));
    dispatch(setChatError(errorMessage));
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
    throw error;
  }
}

interface HandleChatStreamChunkWorkflowParams {
  event: ChatStreamChunkEvent;
  dispatch: Dispatch<AppAction>;
  streamMessageByClientRequestId: Map<string, string>;
  streamSeqByClientRequestId: Map<string, number>;
  streamSessionByClientRequestId: Map<string, string>;
}

function ensureStreamAssistantMessage(args: HandleChatStreamChunkWorkflowParams): {
  assistantMessageId: string | undefined;
  activeSessionId: string | undefined;
} {
  const { event, dispatch, streamMessageByClientRequestId, streamSessionByClientRequestId } = args;
  const existingAssistantMessageId = streamMessageByClientRequestId.get(event.clientRequestId);
  const existingSessionId = streamSessionByClientRequestId.get(event.clientRequestId);
  if (existingAssistantMessageId) {
    return {
      assistantMessageId: existingAssistantMessageId,
      activeSessionId: existingSessionId
    };
  }

  if (!event.messageId) {
    return {
      assistantMessageId: undefined,
      activeSessionId: existingSessionId
    };
  }

  streamMessageByClientRequestId.set(event.clientRequestId, event.messageId);
  if (event.sessionId) {
    streamSessionByClientRequestId.set(event.clientRequestId, event.sessionId);
  }

  dispatch(
    addChatMessage({
      id: event.messageId,
      role: 'assistant',
      content: '',
      relatedFileId: event.fileId,
      sessionId: event.sessionId,
      createdAt: new Date().toISOString(),
      canCreateComment: false,
      feedbackType: event.feedbackType === 'vocabulary' ? 'vocabulary' : undefined,
      vocabulary: event.vocabulary
    })
  );

  return {
    assistantMessageId: event.messageId,
    activeSessionId: event.sessionId ?? existingSessionId
  };
}

export function handleChatStreamChunkWorkflow({
  event,
  dispatch,
  streamMessageByClientRequestId,
  streamSeqByClientRequestId,
  streamSessionByClientRequestId
}: HandleChatStreamChunkWorkflowParams): void {
  const clientRequestId = event.clientRequestId;
  const { assistantMessageId, activeSessionId } = ensureStreamAssistantMessage({
    event,
    dispatch,
    streamMessageByClientRequestId,
    streamSeqByClientRequestId,
    streamSessionByClientRequestId
  });
  if (!assistantMessageId) {
    return;
  }

  const lastSeq = streamSeqByClientRequestId.get(clientRequestId) ?? -1;
  if (!isNewerStreamSeq(lastSeq, event.seq)) {
    return;
  }
  streamSeqByClientRequestId.set(clientRequestId, event.seq);

  if (isContentStreamChunk(event)) {
    dispatch(
      updateChatMessageContent({
        messageId: assistantMessageId,
        content: event.text ?? '',
        mode: 'append'
      })
    );
    if (activeSessionId && (event.text ?? '').trim().length > 0) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
    return;
  }

  if (event.type === 'start') {
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: 'thinking' }));
    }
    return;
  }

  if (event.type === 'status') {
    dispatch(
      updateChatMessageContent({
        messageId: assistantMessageId,
        content:
          event.text ||
          (event.workflow === 'essay-feedback'
            ? 'Processing essay feedback...'
            : 'Processing paragraph feedback...'),
        mode: 'replace'
      })
    );
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: 'thinking' }));
    }
    return;
  }

  if (event.type === 'done') {
    if (event.workflow === 'paragraph-feedback-bulk' && !event.feedbackType) {
      dispatch(removeChatMessage({ messageId: assistantMessageId }));
      streamMessageByClientRequestId.delete(clientRequestId);
      streamSeqByClientRequestId.delete(clientRequestId);
      streamSessionByClientRequestId.delete(clientRequestId);
      if (activeSessionId) {
        dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
      }
      return;
    }

    if (event.workflow === 'essay-feedback') {
      if (event.essayFeedbackStage === 'identify-paragraphs') {
        dispatch(removeChatMessage({ messageId: assistantMessageId }));
        streamMessageByClientRequestId.delete(clientRequestId);
        streamSeqByClientRequestId.delete(clientRequestId);
        streamSessionByClientRequestId.delete(clientRequestId);
      }
      if (activeSessionId) {
        dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
      }
      return;
    }

    dispatch(setChatMessageCommentable({ messageId: assistantMessageId, canCreateComment: true }));
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
    return;
  }

  if (event.type === 'error') {
    const message = event.error?.message || 'Streaming chat request failed.';
    const detailsText =
      event.error?.details === undefined
        ? ''
        : typeof event.error.details === 'string'
          ? event.error.details
          : JSON.stringify(event.error.details);
    const visibleError = detailsText ? `${message}\n\nDetails: ${detailsText}` : message;

    dispatch(
      updateChatMessageContent({
        messageId: assistantMessageId,
        content: visibleError,
        mode: 'replace'
      })
    );

    if (event.workflow === 'paragraph-feedback-bulk' || event.workflow === 'essay-feedback') {
      if (activeSessionId) {
        dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
      }
      return;
    }

    streamMessageByClientRequestId.delete(clientRequestId);
    streamSeqByClientRequestId.delete(clientRequestId);
    streamSessionByClientRequestId.delete(clientRequestId);
    dispatch(setChatStatus('error'));
    dispatch(setChatError(message));
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
  }
}

function formatParagraphFeedbackBulkFailure(reason: string, details: unknown): string {
  const detailsText =
    details === undefined ? '' : typeof details === 'string' ? details : JSON.stringify(details);
  return detailsText ? `${reason}\n\nDetails: ${detailsText}` : reason;
}
