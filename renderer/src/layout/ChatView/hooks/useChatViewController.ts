import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { clearTransientSessionDrafts, setActiveSessionForFile } from '@/layout/ChatInterface/state';
import { createTimestampSessionId } from '@/layout/ChatInterface/domain';
import { usePorts } from '@/app/ports';
import { useAppDispatch } from '@/app/providers/state';
import { toChatViewMessageItems } from '../application/chatView.service';
import {
  createAndActivateSession,
  deleteSessionAndRefresh,
  loadSessionsForFile,
  loadTurnsForSession
} from '../application/chatViewWorkflow.service';
import { useChatViewState } from './useChatViewState';

export function useChatViewController() {
  const appDispatch = useAppDispatch();
  const { llmSession } = usePorts();
  const {
    chatStatus,
    selectedFile,
    activeSessionId,
    sessions,
    sessionsStatus,
    sessionsError,
    sessionSyncNonce,
    sessionMessages,
    activeSessionSendPhase
  } = useChatViewState();

  const [activeScreen, setActiveScreen] = useState<'list' | 'chat'>('list');
  const [isSessionTurnsLoading, setIsSessionTurnsLoading] = useState(false);
  const [sessionTurnsError, setSessionTurnsError] = useState<string | undefined>(undefined);

  const fileEntityUuid = selectedFile?.id ?? null;
  const sessionItems = useMemo(() => toChatViewMessageItems(sessionMessages), [sessionMessages]);

  const handleLoadTurns = useCallback(
    async (sessionId: string, nextFileEntityUuid: string) => {
      await loadTurnsForSession({
        appDispatch,
        llmSession,
        sessionId,
        fileEntityUuid: nextFileEntityUuid,
        setIsSessionTurnsLoading,
        setSessionTurnsError
      });
    },
    [appDispatch, llmSession]
  );

  const handleLoadSessionsForFile = useCallback(
    async (nextFileEntityUuid: string, preferredSessionId?: string) => {
      const errorMessage = await loadSessionsForFile({
        appDispatch,
        llmSession,
        fileEntityUuid: nextFileEntityUuid,
        preferredSessionId,
        setIsSessionTurnsLoading,
        setSessionTurnsError
      });
      if (errorMessage) {
        toast.error(errorMessage);
      }
    },
    [appDispatch, llmSession]
  );

  useEffect(() => {
    if (!fileEntityUuid) {
      setSessionTurnsError(undefined);
      setActiveScreen('list');
      return;
    }

    if ((chatStatus === 'sending' || activeSessionSendPhase) && !activeSessionId) {
      setSessionTurnsError(undefined);
      setActiveScreen('chat');
      return;
    }

    void handleLoadSessionsForFile(fileEntityUuid, activeSessionId ?? undefined);
    if (chatStatus === 'sending' || activeSessionSendPhase) {
      setActiveScreen('chat');
      return;
    }
    setActiveScreen('list');
    // Only reload full session index when selected file changes.
    // TODO: fix exhaustive-deps
  }, [activeSessionId, activeSessionSendPhase, chatStatus, fileEntityUuid, handleLoadSessionsForFile]);

  useEffect(() => {
    if (!fileEntityUuid || !activeSessionId || activeScreen !== 'chat') {
      return;
    }

    void handleLoadTurns(activeSessionId, fileEntityUuid);
    void handleLoadSessionsForFile(fileEntityUuid, activeSessionId);
  }, [
    activeScreen,
    activeSessionId,
    activeSessionSendPhase,
    chatStatus,
    fileEntityUuid,
    handleLoadSessionsForFile,
    handleLoadTurns,
    sessionSyncNonce
  ]);

  useEffect(() => {
    if (!fileEntityUuid) {
      return;
    }
    if (chatStatus !== 'sending' && !activeSessionSendPhase) {
      return;
    }
    setActiveScreen('chat');
  }, [activeSessionSendPhase, chatStatus, fileEntityUuid]);

  const onBack = useCallback(() => {
    setActiveScreen('list');
  }, []);

  const onSessionSelect = useCallback(
    (sessionId: string) => {
      if (!fileEntityUuid) {
        return;
      }

      if (activeSessionId && activeSessionId !== sessionId) {
        appDispatch(clearTransientSessionDrafts({ sessionId: activeSessionId }));
      }

      appDispatch(setActiveSessionForFile({ fileId: fileEntityUuid, sessionId }));
      setActiveScreen('chat');
      void handleLoadTurns(sessionId, fileEntityUuid);
    },
    [activeSessionId, appDispatch, fileEntityUuid, handleLoadTurns]
  );

  const onNewChat = useCallback(async () => {
    if (!fileEntityUuid) {
      return;
    }

    const nextSessionId = createTimestampSessionId(fileEntityUuid);
    const errorMessage = await createAndActivateSession({
      appDispatch,
      llmSession,
      fileEntityUuid,
      nextSessionId,
      activeSessionId: activeSessionId ?? null,
      setIsSessionTurnsLoading,
      setSessionTurnsError
    });

    if (!errorMessage) {
      setActiveScreen('chat');
      return;
    }

    toast.error(errorMessage);
  }, [activeSessionId, appDispatch, fileEntityUuid, llmSession]);

  const onSessionDelete = useCallback(
    async (sessionId: string) => {
      if (!fileEntityUuid) {
        return;
      }

      const errorMessage = await deleteSessionAndRefresh({
        appDispatch,
        llmSession,
        fileEntityUuid,
        sessionIdToDelete: sessionId,
        activeSessionId: activeSessionId ?? null,
        setIsSessionTurnsLoading,
        setSessionTurnsError
      });

      if (errorMessage) {
        toast.error(errorMessage);
        return;
      }

      if (activeSessionId === sessionId) {
        setActiveScreen('list');
      }
    },
    [activeSessionId, appDispatch, fileEntityUuid, llmSession]
  );

  return {
    fileEntityUuid,
    activeScreen,
    sessions,
    activeSessionId,
    sessionsStatus,
    sessionsError,
    sessionItems,
    isSessionTurnsLoading,
    sessionTurnsError,
    showLlmLoading: chatStatus === 'sending' && activeSessionSendPhase !== 'thinking',
    showThinking: activeSessionSendPhase === 'thinking',
    onBack,
    onSessionSelect,
    onNewChat,
    onSessionDelete
  };
}
