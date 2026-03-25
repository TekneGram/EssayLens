import type { ChatMessage, ChatState } from '../domain';
import type { LlmSessionListItemDto } from '@/app/ports/llmSession.port';

type SetMessagesAction = { type: 'chat/setMessages'; payload: ChatMessage[] };
type AddMessageAction = { type: 'chat/addMessage'; payload: ChatMessage };
type SetSessionTranscriptAction = {
  type: 'chat/setSessionTranscript';
  payload: { sessionId: string; messages: ChatMessage[] };
};
type UpdateMessageContentAction = {
  type: 'chat/updateMessageContent';
  payload: { messageId: string; content: string; mode: 'append' | 'replace' };
};
type SetStatusAction = { type: 'chat/setStatus'; payload: ChatState['status'] };
type SetErrorAction = { type: 'chat/setError'; payload?: string };
type SetActiveSessionForFileAction = {
  type: 'chat/setActiveSessionForFile';
  payload: { fileId: string; sessionId: string | null };
};
type SetSessionsForFileAction = {
  type: 'chat/setSessionsForFile';
  payload: { fileId: string; sessions: LlmSessionListItemDto[] };
};
type SetSessionListStatusForFileAction = {
  type: 'chat/setSessionListStatusForFile';
  payload: { fileId: string; status: ChatState['sessionsStatusByFileId'][string] };
};
type SetSessionListErrorForFileAction = {
  type: 'chat/setSessionListErrorForFile';
  payload: { fileId: string; error?: string };
};
type BumpSessionSyncForFileAction = {
  type: 'chat/bumpSessionSyncForFile';
  payload: { fileId: string };
};
type SetSessionSendPhaseAction = {
  type: 'chat/setSessionSendPhase';
  payload: { sessionId: string; phase?: ChatState['sessionSendPhaseBySessionId'][string] };
};
type ClearTransientSessionDraftsAction = {
  type: 'chat/clearTransientSessionDrafts';
  payload: { sessionId: string };
};

export function setChatMessages(payload: ChatMessage[]): SetMessagesAction {
  return { type: 'chat/setMessages', payload };
}

export function addChatMessage(payload: ChatMessage): AddMessageAction {
  return { type: 'chat/addMessage', payload };
}

export function setSessionTranscript(payload: SetSessionTranscriptAction['payload']): SetSessionTranscriptAction {
  return { type: 'chat/setSessionTranscript', payload };
}

export function updateChatMessageContent(payload: UpdateMessageContentAction['payload']): UpdateMessageContentAction {
  return { type: 'chat/updateMessageContent', payload };
}

export function setChatStatus(payload: ChatState['status']): SetStatusAction {
  return { type: 'chat/setStatus', payload };
}

export function setChatError(payload?: string): SetErrorAction {
  return { type: 'chat/setError', payload };
}

export function setActiveSessionForFile(payload: SetActiveSessionForFileAction['payload']): SetActiveSessionForFileAction {
  return { type: 'chat/setActiveSessionForFile', payload };
}

export function setSessionsForFile(payload: SetSessionsForFileAction['payload']): SetSessionsForFileAction {
  return { type: 'chat/setSessionsForFile', payload };
}

export function setSessionListStatusForFile(
  payload: SetSessionListStatusForFileAction['payload']
): SetSessionListStatusForFileAction {
  return { type: 'chat/setSessionListStatusForFile', payload };
}

export function setSessionListErrorForFile(
  payload: SetSessionListErrorForFileAction['payload']
): SetSessionListErrorForFileAction {
  return { type: 'chat/setSessionListErrorForFile', payload };
}

export function bumpSessionSyncForFile(payload: BumpSessionSyncForFileAction['payload']): BumpSessionSyncForFileAction {
  return { type: 'chat/bumpSessionSyncForFile', payload };
}

export function setSessionSendPhase(payload: SetSessionSendPhaseAction['payload']): SetSessionSendPhaseAction {
  return { type: 'chat/setSessionSendPhase', payload };
}

export function clearTransientSessionDrafts(
  payload: ClearTransientSessionDraftsAction['payload']
): ClearTransientSessionDraftsAction {
  return { type: 'chat/clearTransientSessionDrafts', payload };
}

export type ChatInterfaceAction =
  | SetMessagesAction
  | AddMessageAction
  | SetSessionTranscriptAction
  | UpdateMessageContentAction
  | SetStatusAction
  | SetErrorAction
  | SetActiveSessionForFileAction
  | SetSessionsForFileAction
  | SetSessionListStatusForFileAction
  | SetSessionListErrorForFileAction
  | BumpSessionSyncForFileAction
  | SetSessionSendPhaseAction
  | ClearTransientSessionDraftsAction;
