import type { Dispatch } from 'react';
import type { ChatStreamChunkEvent } from '@/app/ports/chat.port';
import {
  addChatMessage,
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
  kind?: 'chat' | 'rubric-feedback';
  message?: string;
  essay?: string;
  rubricId?: string;
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
  selectedFileId,
  activeSessionId,
  pendingSelection,
  streamMessageByClientRequestId,
  streamSeqByClientRequestId,
  streamSessionByClientRequestId
}: SubmitChatMessageWorkflowParams): Promise<void> {
  const clientRequestId = makeLocalId(kind === 'rubric-feedback' ? 'rubricreq' : 'chatreq');
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
        createdAt
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
      kind: 'chat' | 'rubric-feedback';
      fileId?: string;
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
              createdAt
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

        streamMessageByClientRequestId.delete(reply.clientRequestId);
        streamSeqByClientRequestId.delete(reply.clientRequestId);
        streamSessionByClientRequestId.delete(reply.clientRequestId);
      }
    }
    if (streamMessageByClientRequestId.size === 0) {
      dispatch(setChatStatus('idle'));
    }
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
  } catch (error) {
    if (kind === 'rubric-feedback') {
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
      createdAt: new Date().toISOString()
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

  if (event.type === 'done') {
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
    return;
  }

  if (event.type === 'error') {
    streamMessageByClientRequestId.delete(clientRequestId);
    streamSeqByClientRequestId.delete(clientRequestId);
    streamSessionByClientRequestId.delete(clientRequestId);
    const message = event.error?.message || 'Streaming chat request failed.';
    dispatch(setChatStatus('error'));
    dispatch(setChatError(message));
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
  }
}
