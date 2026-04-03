import { useAppState } from '@/app/providers/state';
import {
  selectActiveSessionIdForFile,
  selectChatStatus,
  selectSessionListErrorForFile,
  selectSessionListStatusForFile,
  selectSessionMessagesForFile,
  selectSessionSendPhase,
  selectSessionSyncNonceForFile,
  selectSessionsForFile
} from '@/layout/ChatInterface/state';
import { selectIsChatCollapsed } from '../state';

export function useChatViewState() {
  const state = useAppState();
  const selectedFileId = state.workspace.selectedFile.fileId;
  return {
    isCollapsed: selectIsChatCollapsed(state),
    chatStatus: selectChatStatus(state),
    selectedFile: state.workspace.files.find((file) => file.id === selectedFileId) ?? null,
    activeSessionId: selectActiveSessionIdForFile(state, selectedFileId),
    sessions: selectSessionsForFile(state, selectedFileId),
    sessionsStatus: selectSessionListStatusForFile(state, selectedFileId),
    sessionsError: selectSessionListErrorForFile(state, selectedFileId),
    sessionSyncNonce: selectSessionSyncNonceForFile(state, selectedFileId),
    sessionMessages: selectSessionMessagesForFile(
      state,
      selectedFileId,
      selectActiveSessionIdForFile(state, selectedFileId)
    ),
    activeSessionSendPhase: selectSessionSendPhase(state, selectActiveSessionIdForFile(state, selectedFileId))
  };
}
