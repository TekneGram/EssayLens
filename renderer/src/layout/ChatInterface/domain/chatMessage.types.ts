import type { ChatCommentActionType, VocabularyFeedbackItemDto } from '@/app/ports/chat.port';
import type { ChatRole, EntityId, ISODateString } from '@/app/types';

export interface ChatMessageCommentAction {
  type: ChatCommentActionType;
  text: string;
  vocabularyItem?: VocabularyFeedbackItemDto;
}

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  relatedFileId?: EntityId;
  sessionId?: string;
  createdAt: ISODateString;
  canCreateComment?: boolean;
  commentActionType?: ChatCommentActionType;
  vocabularyItem?: VocabularyFeedbackItemDto;
}

export type ChatDataArray = ChatMessage[];
