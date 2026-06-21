import type { ChatRole, EntityId, ISODateString } from '@/app/types';
import type { ChatFeedbackType, ChatInlineCommentPayload, ChatVocabularyFeedback } from '@/app/ports/chat.port';

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  relatedFileId?: EntityId;
  sessionId?: string;
  createdAt: ISODateString;
  canCreateComment?: boolean;
  feedbackType?: ChatFeedbackType;
  vocabulary?: ChatVocabularyFeedback;
  inlineComment?: ChatInlineCommentPayload;
}

export type ChatDataArray = ChatMessage[];
