import type { ChatRole, EntityId, ISODateString } from '@/app/types';

export interface ChatMessage {
  id: EntityId;
  role: ChatRole;
  content: string;
  relatedFileId?: EntityId;
  sessionId?: string;
  createdAt: ISODateString;
  canCreateComment?: boolean;
}

export type ChatDataArray = ChatMessage[];
