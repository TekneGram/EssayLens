import type { SendChatMessageRequest, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { EssayFeedbackAnalysisRepository } from '../../db/repositories/essayFeedbackAnalysisRepository';
import { LlmChatSessionRepository } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository } from '../../db/repositories/llmSettingsRepository';
import { LlmFeedbackCompletionRepository } from '../../db/repositories/llmFeedbackCompletionRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import { defaultFileExists, defaultIsExecutable, defaultIsFile, resolveDefaultAssetPath, resolveDefaultLlmServerPath } from '../../runtime/llmRuntimeFs';
import {
  isEssayFeedbackBulkRequest,
  isEssayFeedbackRequest,
  isParagraphFeedbackBulkRequest,
  isRubricFeedbackRequest
} from '../../mappers/chatRequestMappers';
import type { ChatServiceDeps } from './chatService.shared';
import { SimpleChatService } from './simpleChatService';
import { RubricFeedbackChatService } from './rubricFeedbackChatService';
import { ParagraphFeedbackBulkChatService } from './paragraphFeedbackBulkChatService';
import { EssayFeedbackChatService } from './essayFeedbackChatService';
import { EssayFeedbackBulkChatService } from './essayFeedbackBulkChatService';

export class ChatService {
  private readonly deps: ChatServiceDeps;
  private readonly simpleChatService: SimpleChatService;
  private readonly rubricFeedbackChatService: RubricFeedbackChatService;
  private readonly paragraphFeedbackBulkChatService: ParagraphFeedbackBulkChatService;
  private readonly essayFeedbackChatService: EssayFeedbackChatService;
  private readonly essayFeedbackBulkChatService: EssayFeedbackBulkChatService;

  constructor(deps: Partial<ChatServiceDeps> & { llmOrchestrator: LlmOrchestrator }) {
    this.deps = {
      repository: new ChatRepository(),
      essayFeedbackAnalysisRepository: new EssayFeedbackAnalysisRepository(),
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
      resolveLlmAssetPath: resolveDefaultAssetPath,
      ...deps
    };
    this.simpleChatService = new SimpleChatService(this.deps);
    this.rubricFeedbackChatService = new RubricFeedbackChatService(this.deps);
    this.paragraphFeedbackBulkChatService = new ParagraphFeedbackBulkChatService(this.deps);
    this.essayFeedbackChatService = new EssayFeedbackChatService(this.deps);
    this.essayFeedbackBulkChatService = new EssayFeedbackBulkChatService(this.deps);
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
    if (isEssayFeedbackBulkRequest(request)) {
      return this.essayFeedbackBulkChatService.sendMessage(request, emitToRenderer);
    }
    if (isEssayFeedbackRequest(request)) {
      return this.essayFeedbackChatService.sendMessage(request, emitToRenderer);
    }
    return this.simpleChatService.sendMessage(request, emitToRenderer);
  }
}
