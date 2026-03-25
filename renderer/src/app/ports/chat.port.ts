import type { AppResult } from '@/app/result';

// --- Chat contract types ---

export interface ChatMessageDto {
  id: string;
  role: 'system' | 'teacher' | 'assistant';
  content: string;
  relatedFileId?: string;
  createdAt: string;
}

export interface ListMessagesResponse {
  messages: ChatMessageDto[];
}

export interface SendChatMessageRequest {
  fileId?: string;
  message: string;
  essay?: string;
  contextText?: string;
  clientRequestId?: string;
  sessionId?: string;
}

export interface SendChatMessageResponse {
  reply: string;
}

export type ChatStreamEventType = 'start' | 'chunk' | 'done' | 'error';

export interface ChatStreamChunkEvent {
  requestId: string;
  clientRequestId: string;
  fileId?: string;
  type: ChatStreamEventType;
  seq: number;
  channel?: 'content' | 'reasoning' | 'meta';
  text?: string;
  done?: boolean;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// --- Port interface ---

export interface ChatPort {
  listMessages(fileId?: string): Promise<AppResult<ListMessagesResponse>>;
  sendMessage(request: SendChatMessageRequest): Promise<AppResult<SendChatMessageResponse>>;
  onStreamChunk(listener: (event: ChatStreamChunkEvent) => void): () => void;
}
