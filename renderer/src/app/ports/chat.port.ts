import type { AppResult } from '@/app/result';

// --- Chat contract types ---

export interface ChatVocabularyFeedback {
  simpleVocabulary: string;
  textContext: string;
  preciseVocabulary: string;
}

export interface ChatInlineCommentPayload {
  searchText: string;
  commentText: string;
}

export interface ChatMessageDto {
  id: string;
  role: 'system' | 'teacher' | 'assistant';
  content: string;
  relatedFileId?: string;
  createdAt: string;
  rubricCategory?: string;
}

export type EssayFeedbackType =
  | 'thesis-statement-feedback'
  | 'summarize-main-idea'
  | 'paragraph-evaluation'
  | 'thesis-restatement-feedback'
  | 'summary-feedback'
  | 'conclusion-final-comment';

export type EssayFeedbackStage = 'identify-paragraphs';
export type EssayFeedbackSection = 'verdict' | 'comments';
export type ChatFeedbackType =
  | 'topic_sentence'
  | 'coherence'
  | 'vocabulary'
  | 'thesis-statement-feedback'
  | 'paragraph-evaluation'
  | 'thesis-restatement-feedback'
  | 'summary-feedback'
  | 'conclusion-final-comment';

export interface ListMessagesResponse {
  messages: ChatMessageDto[];
}

export interface SendChatMessageRequest {
  kind?: 'chat' | 'rubric-feedback' | 'paragraph-feedback-bulk' | 'essay-feedback' | 'essay-feedback-bulk';
  fileId?: string;
  fileIds?: string[];
  redoCompletedFileIds?: string[];
  selectedFeedbackTypes?: EssayFeedbackType[];
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
      inlineComment?: ChatInlineCommentPayload;
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
  essayFeedback?: {
    replies: Array<{
      fileId: string;
      sessionId: string;
      messageId: string;
      reply: string;
      clientRequestId: string;
      essayFeedbackType: EssayFeedbackType;
      essayFeedbackSection?: EssayFeedbackSection;
      feedbackType?: ChatFeedbackType;
      inlineComment?: ChatInlineCommentPayload;
      paragraphFirstSentence?: string;
    }>;
    failures?: Array<{
      fileId: string;
      sessionId: string;
      messageId: string;
      reason: string;
      clientRequestId: string;
      details?: unknown;
      essayFeedbackType?: EssayFeedbackType;
    }>;
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
  workflowKey?: 'paragraph_feedback' | 'essay_feedback';
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
  feedbackType?: ChatFeedbackType;
  feedbackSection?: 'verdict' | 'reason' | 'revision_suggestion';
  vocabulary?: ChatVocabularyFeedback;
  inlineComment?: ChatInlineCommentPayload;
  paragraphFirstSentence?: string;
  workflow?: 'paragraph-feedback-bulk' | 'essay-feedback';
  essayFeedbackType?: EssayFeedbackType;
  essayFeedbackStage?: EssayFeedbackStage;
  essayFeedbackSection?: EssayFeedbackSection;
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
