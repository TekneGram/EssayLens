import type { ChatRole, EntityId, ISODateString } from '@/app/types';
import type { ChatVocabularyFeedback } from '@/app/ports/chat.port';

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  relatedFileId?: EntityId;
  sessionId?: string;
  createdAt: ISODateString;
  canCreateComment?: boolean;
  feedbackType?: 'vocabulary';
  vocabulary?: ChatVocabularyFeedback;
}

export type ChatDataArray = ChatMessage[];
