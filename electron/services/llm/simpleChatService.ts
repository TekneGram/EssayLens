import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { SendChatMessageRequest, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import { mapPythonStreamEventToChatChunkEvent } from '../../mappers/chatStreamEventMapper';
import {
  buildLlmChatPayload,
  requireChatMessage,
  requireReplyText
} from '../../mappers/chatRequestMappers';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type { ChatServiceDeps, EmitChatEvent } from './chatService.shared';
import { resolveSessionId } from './policy/sessionIdPolicy';

export class SimpleChatService {
  private readonly runtimeService: LlmRuntimeService;

  constructor(private readonly deps: ChatServiceDeps) {
    this.runtimeService = new LlmRuntimeService(deps);
  }

  async sendMessage(
    request: SendChatMessageRequest,
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

    const message = requireChatMessage(request);
    const resolvedSessionId = resolveSessionId(request);
    const clientRequestId = request.clientRequestId ?? randomUUID();

    let sessionTurns;
    if (resolvedSessionId) {
      try {
        sessionTurns = await this.deps.llmChatSessionRepository.listRecentTurns(resolvedSessionId);
      } catch (error) {
        throw new AppException({
          code: 'CHAT_SESSION_LOAD_FAILED',
          userMessage: 'Could not load chat session context.',
          details: error
        });
      }
    }

    const llmPayload = buildLlmChatPayload({
      request,
      message,
      sessionId: resolvedSessionId,
      sessionTurns,
      settings
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<typeof llmPayload, SendChatMessageResponse>(
      'llm.chatStream',
      llmPayload,
      (streamEvent) => {
        emitToRenderer(
          mapPythonStreamEventToChatChunkEvent({
            streamEvent,
            request,
            sessionId: resolvedSessionId,
            clientRequestId
          })
        );
      }
    );

    if (!llmResult.ok) {
      throw new AppException({
        code: llmResult.error.code,
        userMessage: llmResult.error.message,
        details: llmResult.error.details
      });
    }

    const reply = requireReplyText(
      llmResult.data,
      'Python worker returned chat success without a valid reply.'
    );

    const createdAt = new Date().toISOString();
    try {
      if (resolvedSessionId) {
        await this.deps.llmChatSessionRepository.appendTurns(
          resolvedSessionId,
          [
            {
              role: 'teacher',
              content: message
            },
            {
              role: 'assistant',
              content: reply
            }
          ],
          request.fileId
        );
      }

      await this.deps.repository.addMessage({
        id: randomUUID(),
        role: 'teacher',
        content: message,
        relatedFileId: request.fileId,
        createdAt
      });
      await this.deps.repository.addMessage({
        id: randomUUID(),
        role: 'assistant',
        content: reply,
        relatedFileId: request.fileId,
        createdAt
      });
      return { reply };
    } catch (error) {
      throw new AppException({
        code: 'CHAT_SEND_PERSIST_FAILED',
        userMessage: 'Chat response was generated but could not be persisted.',
        details: error
      });
    }
  }
}
