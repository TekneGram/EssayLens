import type { ChatVocabularyFeedback } from '@/app/ports/chat.port';
import type { LlmSessionTurnDto } from '@/app/ports/llmSession.port';
import type { ChatMessage } from '@/layout/ChatInterface/domain';

export interface ChatViewMessageItem {
  id: string;
  roleClassName: string;
  roleLabel: string;
  content: string;
  canCreateComment: boolean;
  feedbackType?: 'vocabulary';
  vocabulary?: ChatVocabularyFeedback;
}

export function toChatViewMessageItems(messages: ChatMessage[]): ChatViewMessageItem[] {
  return messages.map((message) => ({
    id: message.id,
    roleClassName: message.role,
    roleLabel: toRoleLabel(message.role),
    content: message.content,
    canCreateComment: message.role === 'assistant' && (message.canCreateComment ?? true),
    feedbackType: message.feedbackType,
    vocabulary: message.vocabulary
  }));
}

export function toSessionTurnItems(sessionId: string, turns: LlmSessionTurnDto[]): ChatViewMessageItem[] {
  return turns.map((turn, index) => ({
    id: `${sessionId}:${turn.role}:${index}`,
    roleClassName: turn.role,
    roleLabel: toRoleLabel(turn.role),
    content: turn.content,
    canCreateComment: turn.role === 'assistant',
    feedbackType: turn.feedbackType,
    vocabulary: turn.vocabulary
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
    createdAt,
    canCreateComment: turn.role === 'assistant',
    feedbackType: turn.feedbackType,
    vocabulary: turn.vocabulary
  }));
}

function toRoleLabel(role: string): string {
  return role.slice(0, 1).toUpperCase() + role.slice(1);
}
