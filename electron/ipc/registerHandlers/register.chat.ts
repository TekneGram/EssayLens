import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { appErr, appOk } from '../../core/appResult';
import {
  CheckParagraphFeedbackCompletionsSchema,
  ListMessagesSchema,
  SendChatMessageSchema
} from '../validationSchemas/chat.schemas';
import type {
  CheckParagraphFeedbackCompletionsResponse,
  ListMessagesResponse,
  ChatStreamChunkEvent
} from '../contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmFeedbackCompletionRepository } from '../../db/repositories/llmFeedbackCompletionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { ChatService } from '../../services/llm/chatService';
import type { LlmOrchestrator } from '../../services/llm/llmOrchestrator';
import type { IpcMainLike } from '../types';

export const CHAT_CHANNELS = {
  listMessages: 'chat/listMessages',
  checkParagraphFeedbackCompletions: 'chat/checkParagraphFeedbackCompletions',
  sendMessage: 'chat/sendMessage'
} as const;

export const CHAT_EVENTS = {
  streamChunk: 'chat/streamChunk'
} as const;

interface ChatHandlerDeps {
  repository: Pick<ChatRepository, 'listMessages'>;
  llmSelectionRepository: Pick<LlmSelectionRepository, 'getActiveModel'>;
  llmFeedbackCompletionRepository: Pick<LlmFeedbackCompletionRepository, 'listCompletedForFiles'>;
  chatService?: ChatService;
  llmOrchestrator: LlmOrchestrator;
}

function getDefaultDeps(): Partial<ChatHandlerDeps> {
  return {
    repository: new ChatRepository(),
    llmSelectionRepository: new LlmSelectionRepository(),
    llmFeedbackCompletionRepository: new LlmFeedbackCompletionRepository()
  };
}

function isEventWithSender(
  event: unknown
): event is { sender: { send: (channel: string, payload: unknown) => void } } {
  if (typeof event !== 'object' || event === null) {
    return false;
  }
  const sender = (event as { sender?: unknown }).sender;
  if (typeof sender !== 'object' || sender === null) {
    return false;
  }
  return typeof (sender as { send?: unknown }).send === 'function';
}

export function registerChatHandlers(ipcMain: IpcMainLike, deps: Partial<ChatHandlerDeps> = {}): void {
  const resolvedDeps = {
    ...getDefaultDeps(),
    ...deps
  } as ChatHandlerDeps;

  if (!resolvedDeps.llmOrchestrator) {
    throw new Error('LlmOrchestrator is required for Chat handlers');
  }

  const chatService = resolvedDeps.chatService ?? new ChatService({ llmOrchestrator: resolvedDeps.llmOrchestrator });

  safeHandle(ipcMain, CHAT_CHANNELS.listMessages, async (payload, _ctx) => {
    const request = validateOrThrow(ListMessagesSchema, payload);
    const messages = await resolvedDeps.repository.listMessages(request.fileId);
    return { messages } as ListMessagesResponse;
  });

  safeHandle(ipcMain, CHAT_CHANNELS.checkParagraphFeedbackCompletions, async (payload, _ctx) => {
    const request = validateOrThrow(CheckParagraphFeedbackCompletionsSchema, payload);
    const activeModel = await resolvedDeps.llmSelectionRepository.getActiveModel();
    if (!activeModel) {
      return {
        activeModel: null,
        completions: []
      } as CheckParagraphFeedbackCompletionsResponse;
    }

    const completions = await resolvedDeps.llmFeedbackCompletionRepository.listCompletedForFiles({
      fileIds: request.fileIds,
      workflowKey: 'paragraph_feedback',
      modelKey: activeModel.key
    });

    return {
      activeModel: {
        key: activeModel.key,
        displayName: activeModel.displayName
      },
      completions: completions.map((completion) => ({
        fileId: completion.fileId,
        modelKey: completion.modelKey,
        modelDisplayName: completion.modelDisplayName,
        sessionId: completion.sessionId,
        completedAt: completion.completedAt
      }))
    } as CheckParagraphFeedbackCompletionsResponse;
  });

  ipcMain.handle(CHAT_CHANNELS.sendMessage, async (event: any, payload: any) => {
    try {
      const request = validateOrThrow(SendChatMessageSchema, payload);
      
      const emitToRenderer = (chunkPayload: ChatStreamChunkEvent) => {
        if (!isEventWithSender(event)) return;
        event.sender.send(CHAT_EVENTS.streamChunk, chunkPayload);
      };

      const response = await chatService.sendMessage(request, emitToRenderer);
      return appOk(response);
    } catch (error: any) {
      if (error && typeof error === 'object' && 'appError' in error) {
        const appException = error as { appError: { code: string; userMessage: string; details?: unknown } };
        return appErr({ code: appException.appError.code, userMessage: appException.appError.userMessage, details: appException.appError.details });
      }
      return appErr({
        code: 'UNKNOWN',
        userMessage: error?.message || 'An unexpected error occurred.'
      });
    }
  });
}
