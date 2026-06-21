import { AppException } from '../core/appException';
import type {
  EssayFeedbackType,
  SendChatMessageRequest,
  SendChatMessageResponse
} from '../ipc/contracts/chat.contracts';
import type { LlmRuntimeSettings } from '../ipc/contracts/llmManager.contracts';
import type { LlmSessionTurn } from '../db/repositories/llmChatSessionRepository';
import type {
  LlmChatPayload,
  LlmEssayFeedbackIdentifyPayload,
  LlmEssayFeedbackStubPayload,
  LlmEssayFeedbackIdentifyResult,
  LlmParagraphFeedbackBulkPayload,
  LlmRubricEvaluationPayload,
  EssayFeedbackRequest,
  ParagraphFeedbackBulkRequest,
  RubricFeedbackCategorySection,
  RubricFeedbackRequest
} from '../services/llm/chatService.shared';

export function isRubricFeedbackRequest(request: SendChatMessageRequest): request is RubricFeedbackRequest {
  return request.kind === 'rubric-feedback' && typeof request.fileId === 'string' && !!request.fileId.trim() && typeof request.essay === 'string' && !!request.essay.trim();
}

export function isParagraphFeedbackBulkRequest(request: SendChatMessageRequest): request is ParagraphFeedbackBulkRequest {
  return request.kind === 'paragraph-feedback-bulk' && Array.isArray(request.fileIds) && request.fileIds.length > 0;
}

export function isEssayFeedbackRequest(request: SendChatMessageRequest): request is EssayFeedbackRequest {
  return (
    request.kind === 'essay-feedback' &&
    typeof request.fileId === 'string' &&
    !!request.fileId.trim() &&
    Array.isArray(request.selectedFeedbackTypes) &&
    request.selectedFeedbackTypes.length > 0
  );
}

export function requireChatMessage(request: SendChatMessageRequest): string {
  const message = typeof request.message === 'string' ? request.message.trim() : '';
  if (!message) {
    throw new AppException({
      code: 'CHAT_INVALID_REQUEST',
      userMessage: 'Chat requests require a non-empty message.'
    });
  }
  return message;
}

export function buildLlmChatPayload(args: {
  request: SendChatMessageRequest;
  message: string;
  sessionId?: string;
  sessionTurns?: LlmSessionTurn[];
  settings: LlmRuntimeSettings;
}): LlmChatPayload {
  const { request, message, sessionId, sessionTurns, settings } = args;
  return {
    ...request,
    message,
    sessionId,
    sessionTurns,
    settings
  };
}

export function buildLlmRubricEvaluationPayload(args: {
  request: RubricFeedbackRequest;
  settings: LlmRuntimeSettings;
  section: RubricFeedbackCategorySection;
}): LlmRubricEvaluationPayload {
  const { request, settings, section } = args;
  return {
    settings,
    essay: request.essay,
    rubricCategory: section.category,
    rubricEntries: section.entries
  };
}

export function buildLlmParagraphFeedbackBulkPayload(args: {
  essay: string;
  settings: LlmRuntimeSettings;
  clientRequestId?: string;
}): LlmParagraphFeedbackBulkPayload {
  return {
    settings: args.settings,
    essay: args.essay,
    clientRequestId: args.clientRequestId
  };
}

export function buildLlmEssayFeedbackStubPayload(args: {
  fileId: string;
  selectedFeedbackTypes: EssayFeedbackType[];
}): LlmEssayFeedbackStubPayload {
  return {
    fileId: args.fileId,
    selectedFeedbackTypes: [...new Set(args.selectedFeedbackTypes)]
  };
}

export function buildLlmEssayFeedbackIdentifyPayload(args: {
  essay: string;
  settings: LlmRuntimeSettings;
  clientRequestId?: string;
}): LlmEssayFeedbackIdentifyPayload {
  return {
    essay: args.essay,
    settings: args.settings,
    clientRequestId: args.clientRequestId
  };
}

export function isEssayFeedbackIdentifyResult(data: unknown): data is LlmEssayFeedbackIdentifyResult {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const value = data as Record<string, unknown>;
  if (
    typeof value.introduction_paragraph !== 'string' ||
    typeof value.conclusion_paragraph !== 'string' ||
    typeof value.body_paragraphs !== 'object' ||
    value.body_paragraphs === null
  ) {
    return false;
  }
  const bodyParagraphs = value.body_paragraphs as Record<string, unknown>;
  if (!Array.isArray(bodyParagraphs.items)) {
    return false;
  }
  return bodyParagraphs.items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as Record<string, unknown>).body_paragraph === 'string'
  );
}

export function getReplyText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const reply = (data as Record<string, unknown>).reply;
  return typeof reply === 'string' && reply.trim().length > 0 ? reply : null;
}

export function requireReplyText(data: unknown, invalidResponseMessage: string): string {
  const reply = getReplyText(data);
  if (!reply) {
    throw new AppException({
      code: 'PY_INVALID_RESPONSE',
      userMessage: invalidResponseMessage,
      details: data
    });
  }
  return reply;
}
