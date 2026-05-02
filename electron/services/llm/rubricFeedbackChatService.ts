import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type {
  RubricFeedbackCategoryReplyDto,
  SendChatMessageResponse
} from '../../ipc/contracts/chat.contracts';
import {
  buildLlmRubricEvaluationPayload,
  requireReplyText
} from '../../mappers/chatRequestMappers';
import { normalizeRubricSections, slugifyCategory } from '../../mappers/rubricSectionMapper';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type { ChatServiceDeps, EmitChatEvent, RubricFeedbackRequest } from './chatService.shared';
import { resolveSessionId } from './policy/sessionIdPolicy';
import { RubricResolutionService } from './rubricResolutionService';

export class RubricFeedbackChatService {
  private readonly runtimeService: LlmRuntimeService;
  private readonly rubricResolutionService: RubricResolutionService;

  constructor(private readonly deps: ChatServiceDeps) {
    this.runtimeService = new LlmRuntimeService(deps);
    this.rubricResolutionService = new RubricResolutionService(deps);
  }

  async sendMessage(
    request: RubricFeedbackRequest,
    emitToRenderer: EmitChatEvent
  ): Promise<SendChatMessageResponse> {
    const { settings, notReadyDetails } = await this.runtimeService.getRuntimeReadyResult();
    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }

    const rubricId = await this.rubricResolutionService.resolveRubricIdForFeedback(request);
    const matrix = await this.rubricResolutionService.loadRubricMatrix(rubricId);
    const sections = normalizeRubricSections(matrix);
    if (sections.length === 0) {
      throw new AppException({
        code: 'RUBRIC_FEEDBACK_INVALID_RUBRIC',
        userMessage: 'The selected rubric does not contain any scored rubric categories.',
        details: { rubricId }
      });
    }

    const resolvedSessionId = resolveSessionId(request);
    const replies: RubricFeedbackCategoryReplyDto[] = [];
    const baseClientRequestId = request.clientRequestId ?? randomUUID();

    for (let index = 0; index < sections.length; index += 1) {
      const section = sections[index];
      const assistantMessageId = randomUUID();
      const categoryClientRequestId = `${baseClientRequestId}:rubric:${index + 1}:${slugifyCategory(section.category)}`;

      emitToRenderer({
        requestId: `${categoryClientRequestId}:start`,
        clientRequestId: categoryClientRequestId,
        fileId: request.fileId,
        sessionId: resolvedSessionId,
        messageId: assistantMessageId,
        rubricCategory: section.category,
        type: 'start',
        seq: 1,
        channel: 'meta',
        text: '',
        done: false
      });

      const llmPayload = buildLlmRubricEvaluationPayload({
        request,
        settings,
        section
      });

      const llmResult = await this.deps.llmOrchestrator.requestAction<typeof llmPayload, SendChatMessageResponse>(
        'llm.evaluate.withRubric',
        llmPayload
      );

      if (!llmResult.ok) {
        emitToRenderer({
          requestId: llmResult.requestId,
          clientRequestId: categoryClientRequestId,
          fileId: request.fileId,
          sessionId: resolvedSessionId,
          messageId: assistantMessageId,
          rubricCategory: section.category,
          type: 'error',
          seq: 2,
          channel: 'meta',
          text: '',
          done: true,
          error: llmResult.error
        });
        throw new AppException({
          code: llmResult.error.code,
          userMessage: llmResult.error.message,
          details: llmResult.error.details
        });
      }

      let reply: string;
      try {
        reply = requireReplyText(
          llmResult.data,
          'Python worker returned rubric feedback success without a valid reply.'
        );
      } catch (error) {
        const appError = error instanceof AppException ? error.appError : {
          code: 'PY_INVALID_RESPONSE',
          userMessage: 'Python worker returned rubric feedback success without a valid reply.',
          details: llmResult.data
        };
        emitToRenderer({
          requestId: llmResult.requestId,
          clientRequestId: categoryClientRequestId,
          fileId: request.fileId,
          sessionId: resolvedSessionId,
          messageId: assistantMessageId,
          rubricCategory: section.category,
          type: 'error',
          seq: 2,
          channel: 'meta',
          text: '',
          done: true,
          error: {
            code: appError.code,
            message: appError.userMessage,
            details: appError.details
          }
        });
        throw error;
      }

      replies.push({
        messageId: assistantMessageId,
        category: section.category,
        reply,
        clientRequestId: categoryClientRequestId
      });

      emitToRenderer({
        requestId: llmResult.requestId,
        clientRequestId: categoryClientRequestId,
        fileId: request.fileId,
        sessionId: resolvedSessionId,
        messageId: assistantMessageId,
        rubricCategory: section.category,
        type: 'chunk',
        seq: 2,
        channel: 'content',
        text: reply,
        done: false
      });

      await this.persistReply({
        sessionId: resolvedSessionId,
        fileId: request.fileId,
        messageId: assistantMessageId,
        reply
      });

      emitToRenderer({
        requestId: `${categoryClientRequestId}:done`,
        clientRequestId: categoryClientRequestId,
        fileId: request.fileId,
        sessionId: resolvedSessionId,
        messageId: assistantMessageId,
        rubricCategory: section.category,
        type: 'done',
        seq: 3,
        channel: 'meta',
        text: '',
        done: true
      });
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      rubricFeedback: {
        replies
      }
    };
  }

  private async persistReply(args: {
    sessionId?: string;
    fileId: string;
    messageId: string;
    reply: string;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    try {
      if (args.sessionId) {
        await this.deps.llmChatSessionRepository.appendTurns(
          args.sessionId,
          [
            {
              role: 'assistant',
              content: args.reply
            }
          ],
          args.fileId
        );
      }

      await this.deps.repository.addMessage({
        id: args.messageId,
        role: 'assistant',
        content: args.reply,
        relatedFileId: args.fileId,
        createdAt
      });
    } catch (error) {
      throw new AppException({
        code: 'CHAT_SEND_PERSIST_FAILED',
        userMessage: 'Rubric feedback response was generated but could not be persisted.',
        details: error
      });
    }
  }
}
