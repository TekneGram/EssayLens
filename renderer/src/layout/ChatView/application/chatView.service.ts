import type { ChatCommentActionType, VocabularyFeedbackItemDto } from '@/app/ports/chat.port';
import type { LlmSessionTurnDto } from '@/app/ports/llmSession.port';
import type { ChatMessage } from '@/layout/ChatInterface/domain';

export interface ChatViewMessageItem {
  id: string;
  roleClassName: string;
  roleLabel: string;
  content: string;
  canCreateComment: boolean;
  commentActionType: ChatCommentActionType;
  vocabularyItem?: VocabularyFeedbackItemDto;
}

export function toChatViewMessageItems(messages: ChatMessage[]): ChatViewMessageItem[] {
  return messages.map((message) => {
    const inferredVocabularyItem = inferVocabularyItemFromContent(message.content);
    return {
      id: message.id,
      roleClassName: message.role,
      roleLabel: toRoleLabel(message.role),
      content: message.content,
      canCreateComment: message.role === 'assistant' && (message.canCreateComment ?? true),
      commentActionType:
        message.commentActionType ??
        (message.role === 'assistant' && inferredVocabularyItem ? 'inline' : 'global'),
      vocabularyItem: message.vocabularyItem ?? inferredVocabularyItem ?? undefined
    };
  });
}

export function toSessionTurnItems(sessionId: string, turns: LlmSessionTurnDto[]): ChatViewMessageItem[] {
  return turns.map((turn, index) => ({
    id: `${sessionId}:${turn.role}:${index}`,
    roleClassName: turn.role,
    roleLabel: toRoleLabel(turn.role),
    content: turn.content,
    canCreateComment: turn.role === 'assistant',
    commentActionType: inferVocabularyItemFromContent(turn.content) ? 'inline' : 'global',
    vocabularyItem: inferVocabularyItemFromContent(turn.content) ?? undefined
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
    canCreateComment: turn.role === 'assistant'
  }));
}

function toRoleLabel(role: string): string {
  return role.slice(0, 1).toUpperCase() + role.slice(1);
}

function inferVocabularyItemFromContent(content: string): VocabularyFeedbackItemDto | null {
  const match = content.match(
    /^You used (?<simple>.+?) when you wrote (?<context>.+?)\. You can improve this with the following: (?<precise>.+)$/s
  );
  if (!match?.groups) {
    return null;
  }

  const simple_vocabulary = match.groups.simple.trim();
  const text_context = match.groups.context.trim();
  const precise_vocabulary = match.groups.precise.trim();
  if (!simple_vocabulary || !text_context || !precise_vocabulary) {
    return null;
  }

  return {
    simple_vocabulary,
    text_context,
    precise_vocabulary
  };
}
