import type { AppResult } from '@/app/result';

// --- Chat contract types ---

export interface ChatVocabularyFeedback {
  simpleVocabulary: string;
  textContext: string;
  preciseVocabulary: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'system' | 'teacher' | 'assistant';
  content: string;
  relatedFileId?: string;
  createdAt: string;
  rubricCategory?: string;
}

export interface ListMessagesResponse {
  messages: ChatMessageDto[];
}

export interface SendChatMessageRequest {
  kind?: 'chat' | 'rubric-feedback' | 'paragraph-feedback-bulk';
  fileId?: string;
  fileIds?: string[];
  redoCompletedFileIds?: string[];
  message?: string;
  essay?: string;
  contextText?: string;
  clientRequestId?: string;
  sessionId?: string;
  rubricId?: string;
  systemPrompt?: string;
}

export interface RubricFeedbackCategoryReplyDto {
  messageId: string;
  category: string;
  reply: string;
  clientRequestId: string;
}

export interface SendChatMessageResponse {
  reply: string;
  rubricFeedback?: {
    replies: RubricFeedbackCategoryReplyDto[];
  };
  paragraphFeedbackBulk?: {
    replies: Array<{
      fileId: string;
      sessionId: string;
      messageId: string;
      reply: string;
      clientRequestId: string;
      feedbackType?: 'topic_sentence' | 'coherence' | 'vocabulary';
      feedbackSection?: 'verdict' | 'reason' | 'revision_suggestion';
      vocabulary?: ChatVocabularyFeedback;
      diagnosticType?: 'reasoning_leak';
      progressMessageId?: string;
    }>;
    failures?: Array<{
      fileId: string;
      sessionId: string;
      messageId: string;
      reason: string;
      clientRequestId: string;
      details?: unknown;
      progressMessageId?: string;
    }>;
    failedFileIds?: string[];
    skippedFileIds?: string[];
  };
}

export interface ParagraphFeedbackCompletionDto {
  fileId: string;
  modelKey: string;
  modelDisplayName: string;
  sessionId: string;
  completedAt: string;
}

export interface CheckParagraphFeedbackCompletionsRequest {
  fileIds: string[];
}

export interface CheckParagraphFeedbackCompletionsResponse {
  activeModel: {
    key: string;
    displayName: string;
  } | null;
  completions: ParagraphFeedbackCompletionDto[];
}

export type ChatStreamEventType = 'start' | 'status' | 'chunk' | 'done' | 'error';

export interface ChatStreamChunkEvent {
  requestId: string;
  clientRequestId: string;
  fileId?: string;
  sessionId?: string;
  messageId?: string;
  rubricCategory?: string;
  feedbackType?: 'topic_sentence' | 'coherence' | 'vocabulary';
  feedbackSection?: 'verdict' | 'reason' | 'revision_suggestion';
  vocabulary?: ChatVocabularyFeedback;
  workflow?: 'paragraph-feedback-bulk';
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
  checkParagraphFeedbackCompletions(
    request: CheckParagraphFeedbackCompletionsRequest
  ): Promise<AppResult<CheckParagraphFeedbackCompletionsResponse>>;
  sendMessage(request: SendChatMessageRequest): Promise<AppResult<SendChatMessageResponse>>;
  onStreamChunk(listener: (event: ChatStreamChunkEvent) => void): () => void;
}
