import { AppException } from '../core/appException';
import type {
  SendChatMessageRequest,
  SendChatMessageResponse
} from '../ipc/contracts/chat.contracts';
import type { LlmRuntimeSettings } from '../ipc/contracts/llmManager.contracts';
import type { LlmSessionTurn } from '../db/repositories/llmChatSessionRepository';
import type {
  LlmChatPayload,
  LlmRubricEvaluationPayload,
  RubricFeedbackCategorySection,
  RubricFeedbackRequest
} from '../services/llm/chatService.shared';

export function isRubricFeedbackRequest(request: SendChatMessageRequest): request is RubricFeedbackRequest {
  return request.kind === 'rubric-feedback' && typeof request.fileId === 'string' && !!request.fileId.trim() && typeof request.essay === 'string' && !!request.essay.trim();
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
