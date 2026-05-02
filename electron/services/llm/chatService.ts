import type { SendChatMessageRequest, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmChatSessionRepository } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository } from '../../db/repositories/llmSettingsRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import { defaultFileExists, defaultIsExecutable, defaultIsFile, resolveDefaultLlmServerPath } from '../../runtime/llmRuntimeFs';
import { isRubricFeedbackRequest } from '../../mappers/chatRequestMappers';
import type { ChatServiceDeps } from './chatService.shared';
import { SimpleChatService } from './simpleChatService';
import { RubricFeedbackChatService } from './rubricFeedbackChatService';

export class ChatService {
  private readonly deps: ChatServiceDeps;
  private readonly simpleChatService: SimpleChatService;
  private readonly rubricFeedbackChatService: RubricFeedbackChatService;

  constructor(deps: Partial<ChatServiceDeps> & { llmOrchestrator: LlmOrchestrator }) {
    this.deps = {
      repository: new ChatRepository(),
      llmSettingsRepository: new LlmSettingsRepository(),
      llmChatSessionRepository: new LlmChatSessionRepository(),
      llmSelectionRepository: new LlmSelectionRepository(),
      rubricRepository: new RubricRepository(),
      fileExists: defaultFileExists,
      isFile: defaultIsFile,
      isExecutable: defaultIsExecutable,
      resolveLlmServerPath: resolveDefaultLlmServerPath,
      ...deps
    };
    this.simpleChatService = new SimpleChatService(this.deps);
    this.rubricFeedbackChatService = new RubricFeedbackChatService(this.deps);
  }

  async sendMessage(
    request: SendChatMessageRequest,
    emitToRenderer: Parameters<SimpleChatService['sendMessage']>[1]
  ): Promise<SendChatMessageResponse> {
    if (isRubricFeedbackRequest(request)) {
      return this.rubricFeedbackChatService.sendMessage(request, emitToRenderer);
    }
    return this.simpleChatService.sendMessage(request, emitToRenderer);
  }
}
