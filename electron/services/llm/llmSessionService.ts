import type { LlmChatSessionRepository } from '../../db/repositories/llmChatSessionRepository';
import type { LlmOrchestrator } from './llmOrchestrator';

export interface LlmSessionServiceDeps {
  llmChatSessionRepository: Pick<
    LlmChatSessionRepository,
    'createSession' | 'clearSession' | 'deleteSession' | 'listRecentTurns' | 'listSessionsByFile'
  >;
  llmOrchestrator: Pick<LlmOrchestrator, 'requestAction'>;
}

export class LlmSessionService {
  private readonly repository: LlmSessionServiceDeps['llmChatSessionRepository'];
  private readonly orchestrator: LlmSessionServiceDeps['llmOrchestrator'];

  constructor(deps: LlmSessionServiceDeps) {
    this.repository = deps.llmChatSessionRepository;
    this.orchestrator = deps.llmOrchestrator;
  }

  async createSession(sessionId: string, fileEntityUuid: string) {
    return this.repository.createSession(sessionId, fileEntityUuid);
  }

  async clearSession(sessionId: string) {
    await this.clearSimpleChatSessionCache(sessionId);
    return this.repository.clearSession(sessionId);
  }

  async deleteSession(sessionId: string) {
    await this.clearSimpleChatSessionCache(sessionId);
    return this.repository.deleteSession(sessionId);
  }

  async listRecentTurns(sessionId: string, fileEntityUuid: string) {
    return this.repository.listRecentTurns(sessionId, fileEntityUuid);
  }

  async listSessionsByFile(fileEntityUuid: string) {
    return this.repository.listSessionsByFile(fileEntityUuid);
  }

  private async clearSimpleChatSessionCache(sessionId: string): Promise<void> {
    const result = await this.orchestrator.requestAction<
      { sessionId: string },
      { sessionId: string; cleared: boolean }
    >('llm.simpleChat.clearSessionCache', { sessionId });
    if (!result.ok) {
      throw new Error(result.error.message || 'Could not clear simple-chat session cache.');
    }
  }
}
