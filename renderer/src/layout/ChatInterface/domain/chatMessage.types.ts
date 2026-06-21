import type { ChatRole, EntityId, ISODateString } from '@/app/types';
import type { ChatFeedbackType, ChatInlineCommentPayload, ChatVocabularyFeedback } from '@/app/ports/chat.port';

export type ChatMessageSource = 'local' | 'persisted' | 'stream-status' | 'stream-reply';

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  relatedFileId?: EntityId;
  sessionId?: string;
  createdAt: ISODateString;
  messageSource?: ChatMessageSource;
  canCreateComment?: boolean;
  feedbackType?: ChatFeedbackType;
  vocabulary?: ChatVocabularyFeedback;
  inlineComment?: ChatInlineCommentPayload;
}

export type ChatDataArray = ChatMessage[];
