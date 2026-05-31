import type { SendChatMessageRequest, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmChatSessionRepository } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository } from '../../db/repositories/llmSettingsRepository';
import { LlmFeedbackCompletionRepository } from '../../db/repositories/llmFeedbackCompletionRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import { defaultFileExists, defaultIsExecutable, defaultIsFile, resolveDefaultLlmServerPath } from '../../runtime/llmRuntimeFs';
import { isParagraphFeedbackBulkRequest, isRubricFeedbackRequest } from '../../mappers/chatRequestMappers';
import type { ChatServiceDeps } from './chatService.shared';
import { SimpleChatService } from './simpleChatService';
import { RubricFeedbackChatService } from './rubricFeedbackChatService';
import { ParagraphFeedbackBulkChatService } from './paragraphFeedbackBulkChatService';

export class ChatService {
  private readonly deps: ChatServiceDeps;
  private readonly simpleChatService: SimpleChatService;
  private readonly rubricFeedbackChatService: RubricFeedbackChatService;
  private readonly paragraphFeedbackBulkChatService: ParagraphFeedbackBulkChatService;

  constructor(deps: Partial<ChatServiceDeps> & { llmOrchestrator: LlmOrchestrator }) {
    this.deps = {
      repository: new ChatRepository(),
      llmSettingsRepository: new LlmSettingsRepository(),
      llmChatSessionRepository: new LlmChatSessionRepository(),
      llmSelectionRepository: new LlmSelectionRepository(),
      llmFeedbackCompletionRepository: new LlmFeedbackCompletionRepository(),
      rubricRepository: new RubricRepository(),
      workspaceRepository: new WorkspaceRepository(),
      fileExists: defaultFileExists,
      isFile: defaultIsFile,
      isExecutable: defaultIsExecutable,
      resolveLlmServerPath: resolveDefaultLlmServerPath,
      ...deps
    };
    this.simpleChatService = new SimpleChatService(this.deps);
    this.rubricFeedbackChatService = new RubricFeedbackChatService(this.deps);
    this.paragraphFeedbackBulkChatService = new ParagraphFeedbackBulkChatService(this.deps);
  }

  async sendMessage(
    request: SendChatMessageRequest,
    emitToRenderer: Parameters<SimpleChatService['sendMessage']>[1]
  ): Promise<SendChatMessageResponse> {
    if (isRubricFeedbackRequest(request)) {
      return this.rubricFeedbackChatService.sendMessage(request, emitToRenderer);
    }
    if (isParagraphFeedbackBulkRequest(request)) {
      return this.paragraphFeedbackBulkChatService.sendMessage(request, emitToRenderer);
    }
    return this.simpleChatService.sendMessage(request, emitToRenderer);
  }
}
