import type { LlmSessionTurnDto } from '@/app/ports/llmSession.port';
import type { ChatMessage } from '@/layout/ChatInterface/domain';

export interface ChatViewMessageItem {
  id: string;
  roleClassName: string;
  text: string;
}

export function toChatViewMessageItems(messages: ChatMessage[]): ChatViewMessageItem[] {
  return messages.map((message) => ({
    id: message.id,
    roleClassName: message.role,
    text: `[${message.role}] ${message.content}`
  }));
}

export function toActionMessageItems(messages: ChatMessage[]): ChatViewMessageItem[] {
  return messages
    .filter((message) => message.role === 'system')
    .map((message) => ({
      id: message.id,
      roleClassName: message.role,
      text: message.content
    }));
}

export function toSessionTurnItems(sessionId: string, turns: LlmSessionTurnDto[]): ChatViewMessageItem[] {
  return turns.map((turn, index) => ({
    id: `${sessionId}:${turn.role}:${index}`,
    roleClassName: turn.role,
    text: turn.content
  }));
}

export function toSessionChatMessages(sessionId: string, fileEntityUuid: string, turns: LlmSessionTurnDto[]): ChatMessage[] {
  const createdAt = new Date().toISOString();
  return turns.map((turn, index) => ({
    id: `${sessionId}:${turn.role}:${index}`,
    role: turn.role,
    content: turn.content,
    relatedFileId: fileEntityUuid,
    sessionId,
    createdAt
  }));
}
