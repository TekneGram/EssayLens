import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { StopLlmServerResponse } from '../../ipc/contracts/llmServer.contracts';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type { ChatServiceDeps, EmitChatEvent, EssayFeedbackBulkRequest } from './chatService.shared';
import { EssayFeedbackChatService } from './essayFeedbackChatService';

interface EssayFeedbackBulkFailure {
  fileId: string;
  sessionId: string;
  messageId: string;
  reason: string;
  clientRequestId: string;
  details?: unknown;
}

export class EssayFeedbackBulkChatService {
  private readonly runtimeService: LlmRuntimeService;
  private readonly essayFeedbackChatService: EssayFeedbackChatService;

  constructor(private readonly deps: ChatServiceDeps) {
    this.runtimeService = new LlmRuntimeService(deps);
    this.essayFeedbackChatService = new EssayFeedbackChatService(deps);
  }

  async sendMessage(request: EssayFeedbackBulkRequest, emitToRenderer: EmitChatEvent) {
    const { settings, notReadyDetails } = await this.runtimeService.getRuntimeReadyResult();
    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }

    const fileIds = [...new Set(request.fileIds.map((fileId) => fileId.trim()).filter((fileId) => fileId.length > 0))];
    if (fileIds.length === 0) {
      throw new AppException({
        code: 'CHAT_INVALID_REQUEST',
        userMessage: 'Essay feedback in bulk requires at least one file id.'
      });
    }
    if (request.selectedFeedbackTypes.length === 0) {
      throw new AppException({
        code: 'CHAT_INVALID_REQUEST',
        userMessage: 'Essay feedback in bulk requires at least one selected feedback type.'
      });
    }

    const baseClientRequestId = request.clientRequestId ?? randomUUID();
    const replies: NonNullable<Awaited<ReturnType<EssayFeedbackChatService['sendMessage']>>['essayFeedback']>['replies'] = [];
    const failures: EssayFeedbackBulkFailure[] = [];
    const activeModel = await this.deps.llmSelectionRepository.getActiveModel();
    const redoCompletedFileIds = new Set((request.redoCompletedFileIds ?? []).map((fileId) => fileId.trim()).filter(Boolean));
    const completedFileIds = activeModel
      ? new Set(
          (
            await this.deps.llmFeedbackCompletionRepository.listCompletedForFiles({
              fileIds,
              workflowKey: 'essay_feedback',
              modelKey: activeModel.key
            })
          ).map((completion) => completion.fileId)
        )
      : new Set<string>();

    try {
      for (let index = 0; index < fileIds.length; index += 1) {
        const fileId = fileIds[index];
        const sessionId = `essay-feedback:${fileId}:${Date.now()}:${index + 1}`;
        const clientRequestId = `${baseClientRequestId}:essaybulk:${index + 1}`;

        if (completedFileIds.has(fileId) && !redoCompletedFileIds.has(fileId)) {
          continue;
        }

        try {
          const result = await this.essayFeedbackChatService.sendMessage(
            {
              kind: 'essay-feedback',
              fileId,
              sessionId,
              clientRequestId,
              selectedFeedbackTypes: request.selectedFeedbackTypes
            },
            emitToRenderer
          );
          replies.push(...(result.essayFeedback?.replies ?? []));
          failures.push(...((result.essayFeedback?.failures ?? []) as EssayFeedbackBulkFailure[]));
        } catch (error) {
          const messageId = randomUUID();
          const reason = error instanceof Error ? error.message : 'Essay feedback file failed.';
          failures.push({
            fileId,
            sessionId,
            messageId,
            reason,
            clientRequestId,
            details: error
          });
          emitToRenderer({
            requestId: `${clientRequestId}:error`,
            clientRequestId,
            fileId,
            sessionId,
            messageId,
            workflow: 'essay-feedback',
            type: 'error',
            seq: 999,
            channel: 'meta',
            text: '',
            done: true,
            error: {
              code: 'ESSAY_FEEDBACK_BULK_FILE_FAILED',
              message: reason,
              details: error
            }
          });
        } finally {
          await this.recycleBulkRuntimeAfterFile(settings, fileId);
        }
      }
    } finally {
      await this.stopRuntimeAfterBatch();
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      essayFeedback: {
        replies,
        failures
      }
    };
  }

  private shouldRecycleBulkRuntime(settings: { bulk_llm_recycle_policy?: string }): boolean {
    return (settings.bulk_llm_recycle_policy ?? 'after_each_file') === 'after_each_file';
  }

  private async recycleBulkRuntimeAfterFile(settings: { bulk_llm_recycle_policy?: string }, fileId: string): Promise<void> {
    if (!this.shouldRecycleBulkRuntime(settings)) {
      return;
    }
    const result = await this.deps.llmOrchestrator.requestAction<{}, StopLlmServerResponse>('llm.server.stop', {});
    if (!result.ok) {
      console.warn('Could not recycle LLM runtime after bulk essay feedback file.', {
        fileId,
        error: result.error
      });
    }
  }

  private async stopRuntimeAfterBatch(): Promise<void> {
    const result = await this.deps.llmOrchestrator.requestAction<{}, StopLlmServerResponse>('llm.server.stop', {});
    if (!result.ok) {
      console.warn('Could not stop LLM runtime after bulk essay feedback batch.', {
        error: result.error
      });
    }
  }
}
