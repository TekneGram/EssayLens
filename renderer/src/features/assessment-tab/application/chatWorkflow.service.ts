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
  message: string;
  essay?: string;
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
  message,
  essay,
  selectedFileId,
  activeSessionId,
  pendingSelection,
  streamMessageByClientRequestId,
  streamSeqByClientRequestId,
  streamSessionByClientRequestId
}: SubmitChatMessageWorkflowParams): Promise<void> {
  const clientRequestId = makeLocalId('chatreq');
  const teacherMessageId = makeLocalId('teacher');
  const assistantMessageId = makeLocalId('assistant');
  const createdAt = new Date().toISOString();

  streamMessageByClientRequestId.set(clientRequestId, assistantMessageId);
  streamSeqByClientRequestId.set(clientRequestId, -1);
  if (activeSessionId) {
    streamSessionByClientRequestId.set(clientRequestId, activeSessionId);
  }

  dispatch(
    addChatMessage({
      id: teacherMessageId,
      role: 'teacher',
      content: message,
      relatedFileId: selectedFileId ?? undefined,
      sessionId: activeSessionId,
      createdAt
    })
  );
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
  dispatch(setChatStatus('sending'));
  dispatch(setChatError(undefined));
  if (activeSessionId) {
    dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: 'warming' }));
  }

  try {
    const result = await chatApi.sendMessage({
      fileId: selectedFileId ?? undefined,
      sessionId: activeSessionId,
      message,
      essay,
      contextText: pendingSelection?.exactQuote,
      clientRequestId
    });
    if (!result.ok) {
      throw new Error(result.error.message || 'Unable to send chat message.');
    }

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
    if (streamMessageByClientRequestId.size === 0) {
      dispatch(setChatStatus('idle'));
    }
    if (activeSessionId) {
      dispatch(setSessionSendPhase({ sessionId: activeSessionId, phase: undefined }));
    }
  } catch (error) {
    streamMessageByClientRequestId.delete(clientRequestId);
    streamSeqByClientRequestId.delete(clientRequestId);
    streamSessionByClientRequestId.delete(clientRequestId);
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

export function handleChatStreamChunkWorkflow({
  event,
  dispatch,
  streamMessageByClientRequestId,
  streamSeqByClientRequestId,
  streamSessionByClientRequestId
}: HandleChatStreamChunkWorkflowParams): void {
  const clientRequestId = event.clientRequestId;
  const assistantMessageId = streamMessageByClientRequestId.get(clientRequestId);
  const activeSessionId = streamSessionByClientRequestId.get(clientRequestId);
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
    streamMessageByClientRequestId.delete(clientRequestId);
    streamSeqByClientRequestId.delete(clientRequestId);
    streamSessionByClientRequestId.delete(clientRequestId);
    if (streamMessageByClientRequestId.size === 0) {
      dispatch(setChatStatus('idle'));
    }
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
