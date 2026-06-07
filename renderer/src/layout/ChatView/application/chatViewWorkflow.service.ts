import {
  clearTransientSessionDrafts,
  setActiveSessionForFile,
  setSessionListErrorForFile,
  setSessionListStatusForFile,
  setSessionTranscript,
  setSessionsForFile
} from '@/layout/ChatInterface/state';
import type { Dispatch } from 'react';
import type { LlmSessionPort } from '@/app/ports/llmSession.port';
import type { AppAction } from '@/app/providers/state';
import { resolvePreferredSession, toDeleteSessionErrorMessage, toListByFileErrorMessage } from '../domain/chatViewSession.domain';
import { toSessionChatMessages } from './chatView.service';

interface ChatViewWorkflowDependencies {
  appDispatch: Dispatch<AppAction>;
  llmSession: LlmSessionPort;
}

interface SessionTurnsUiActions {
  setIsSessionTurnsLoading: (isLoading: boolean) => void;
  setSessionTurnsError: (error: string | undefined) => void;
}

interface LoadTurnsInput extends ChatViewWorkflowDependencies, SessionTurnsUiActions {
  sessionId: string;
  fileEntityUuid: string;
  preserveExistingWhenEmpty?: boolean;
}

export async function loadTurnsForSession({
  appDispatch,
  llmSession,
  sessionId,
  fileEntityUuid,
  preserveExistingWhenEmpty = false,
  setIsSessionTurnsLoading,
  setSessionTurnsError
}: LoadTurnsInput): Promise<void> {
  setIsSessionTurnsLoading(true);
  setSessionTurnsError(undefined);
  try {
    const turnsResult = await llmSession.getTurns({ sessionId, fileEntityUuid });
    if (!turnsResult.ok) {
      setSessionTurnsError(turnsResult.error.message || 'Could not load chat turns.');
      return;
    }

    appDispatch(
      setSessionTranscript({
        sessionId,
        messages: toSessionChatMessages(sessionId, fileEntityUuid, turnsResult.data.turns),
        preserveExistingWhenEmpty
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load chat turns.';
    setSessionTurnsError(message);
  } finally {
    setIsSessionTurnsLoading(false);
  }
}

interface LoadSessionsInput extends ChatViewWorkflowDependencies, SessionTurnsUiActions {
  fileEntityUuid: string;
  preferredSessionId?: string;
  preserveExistingWhenEmpty?: boolean;
}

export async function loadSessionsForFile({
  appDispatch,
  llmSession,
  fileEntityUuid,
  preferredSessionId,
  preserveExistingWhenEmpty = false,
  setIsSessionTurnsLoading,
  setSessionTurnsError
}: LoadSessionsInput): Promise<string | undefined> {
  appDispatch(setSessionListStatusForFile({ fileId: fileEntityUuid, status: 'loading' }));
  appDispatch(setSessionListErrorForFile({ fileId: fileEntityUuid, error: undefined }));

  try {
    const result = await llmSession.listByFile({ fileEntityUuid });
    if (!result.ok) {
      const message = toListByFileErrorMessage(result.error.code, result.error.message);
      appDispatch(setSessionListStatusForFile({ fileId: fileEntityUuid, status: 'error' }));
      appDispatch(setSessionListErrorForFile({ fileId: fileEntityUuid, error: message }));
      return message;
    }

    appDispatch(setSessionsForFile({ fileId: fileEntityUuid, sessions: result.data.sessions }));
    appDispatch(setSessionListStatusForFile({ fileId: fileEntityUuid, status: 'idle' }));
    appDispatch(setSessionListErrorForFile({ fileId: fileEntityUuid, error: undefined }));

    const preferredSession = resolvePreferredSession(result.data.sessions, preferredSessionId);
    if (!preferredSession) {
      if (preferredSessionId) {
        // Keep the optimistic in-memory session active while persistence catches up.
        appDispatch(setActiveSessionForFile({ fileId: fileEntityUuid, sessionId: preferredSessionId }));
      }
      return undefined;
    }

    appDispatch(setActiveSessionForFile({ fileId: fileEntityUuid, sessionId: preferredSession.sessionId }));
    await loadTurnsForSession({
      appDispatch,
      llmSession,
      sessionId: preferredSession.sessionId,
      fileEntityUuid,
      preserveExistingWhenEmpty,
      setIsSessionTurnsLoading,
      setSessionTurnsError
    });
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load chat sessions.';
    appDispatch(setSessionListStatusForFile({ fileId: fileEntityUuid, status: 'error' }));
    appDispatch(setSessionListErrorForFile({ fileId: fileEntityUuid, error: message }));
    return message;
  }
}

interface CreateNewSessionInput extends ChatViewWorkflowDependencies, SessionTurnsUiActions {
  fileEntityUuid: string;
  nextSessionId: string;
  activeSessionId: string | null;
}

export async function createAndActivateSession({
  appDispatch,
  llmSession,
  fileEntityUuid,
  nextSessionId,
  activeSessionId,
  setIsSessionTurnsLoading,
  setSessionTurnsError
}: CreateNewSessionInput): Promise<string | undefined> {
  setSessionTurnsError(undefined);
  setIsSessionTurnsLoading(true);
  try {
    const createResult = await llmSession.create({ sessionId: nextSessionId, fileEntityUuid });
    if (!createResult.ok) {
      const message = createResult.error.message || 'Could not create chat session.';
      setSessionTurnsError(message);
      return message;
    }

    if (activeSessionId) {
      appDispatch(clearTransientSessionDrafts({ sessionId: activeSessionId }));
    }

    appDispatch(setActiveSessionForFile({ fileId: fileEntityUuid, sessionId: nextSessionId }));
    return await loadSessionsForFile({
      appDispatch,
      llmSession,
      fileEntityUuid,
      preferredSessionId: nextSessionId,
      setIsSessionTurnsLoading,
      setSessionTurnsError
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not create chat session.';
    setSessionTurnsError(message);
    return message;
  } finally {
    setIsSessionTurnsLoading(false);
  }
}

interface DeleteSessionInput extends ChatViewWorkflowDependencies, SessionTurnsUiActions {
  fileEntityUuid: string;
  sessionIdToDelete: string;
  activeSessionId: string | null;
}

export async function deleteSessionAndRefresh({
  appDispatch,
  llmSession,
  fileEntityUuid,
  sessionIdToDelete,
  activeSessionId,
  setIsSessionTurnsLoading,
  setSessionTurnsError
}: DeleteSessionInput): Promise<string | undefined> {
  try {
    const result = await llmSession.delete({ sessionId: sessionIdToDelete });
    if (!result.ok) {
      return toDeleteSessionErrorMessage(result.error.code, result.error.message);
    }
  } catch (error) {
    return error instanceof Error ? error.message : 'Could not delete chat session.';
  }

  appDispatch(clearTransientSessionDrafts({ sessionId: sessionIdToDelete }));
  const preferredSessionId = activeSessionId === sessionIdToDelete ? undefined : activeSessionId ?? undefined;
  const errorMessage = await loadSessionsForFile({
    appDispatch,
    llmSession,
    fileEntityUuid,
    preferredSessionId,
    setIsSessionTurnsLoading,
    setSessionTurnsError
  });
  if (!errorMessage && activeSessionId === sessionIdToDelete && !preferredSessionId) {
    appDispatch(setActiveSessionForFile({ fileId: fileEntityUuid, sessionId: null }));
  }
  return errorMessage;
}
