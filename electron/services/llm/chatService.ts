import fsPromises from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { ChatStreamChunkEvent, SendChatMessageRequest, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmChatSessionRepository, type LlmSessionTurn } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository, type LlmRuntimeSettings } from '../../db/repositories/llmSettingsRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import { resolveLlamaServerPath } from '../../runtime/runtimePaths';
import { getLlmNotReadyDetails } from '../../runtime/llmRuntimeReadiness';
import type { LlmNotReadyErrorDetails } from '../../ipc/contracts/chat.contracts';

interface ChatServiceDeps {
  repository: ChatRepository;
  llmOrchestrator: LlmOrchestrator;
  llmSettingsRepository: LlmSettingsRepository;
  llmChatSessionRepository: LlmChatSessionRepository;
  llmSelectionRepository: LlmSelectionRepository;
  fileExists: (targetPath: string) => Promise<boolean>;
  isExecutable: (targetPath: string) => Promise<boolean>;
  resolveLlmServerPath: () => string;
}

interface LlmChatPayload extends SendChatMessageRequest {
  sessionTurns?: LlmSessionTurn[];
  settings: LlmRuntimeSettings;
}

async function defaultFileExists(targetPath: string): Promise<boolean> {
  try {
    await fsPromises.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function defaultIsExecutable(targetPath: string): Promise<boolean> {
  if (process.platform === 'win32') return true;
  try {
    await fsPromises.access(targetPath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDefaultLlmServerPath(): string {
  const runtimeMode = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' ? 'dev' : 'packaged';
  return resolveLlamaServerPath({ mode: runtimeMode });
}

function canRecoverServerPathIssues(details: LlmNotReadyErrorDetails): boolean {
  const recoverableCodes = new Set(['MISSING_SERVER_PATH', 'SERVER_FILE_NOT_FOUND', 'SERVER_NOT_EXECUTABLE']);
  return details.issues.length > 0 && details.issues.every((issue) => recoverableCodes.has(issue.code));
}

function resolveSessionId(request: SendChatMessageRequest): string | undefined {
  if (typeof request.sessionId === 'string' && request.sessionId.trim()) {
    return request.sessionId.trim();
  }
  if (typeof request.fileId === 'string' && request.fileId.trim()) {
    return `file:${request.fileId}`;
  }
  return undefined;
}

function getReplyText(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const reply = (data as Record<string, unknown>).reply;
  return typeof reply === 'string' && reply.trim().length > 0 ? reply : null;
}

export class ChatService {
  private readonly deps: ChatServiceDeps;

  constructor(deps: Partial<ChatServiceDeps> & { llmOrchestrator: LlmOrchestrator }) {
    this.deps = {
      repository: new ChatRepository(),
      llmSettingsRepository: new LlmSettingsRepository(),
      llmChatSessionRepository: new LlmChatSessionRepository(),
      llmSelectionRepository: new LlmSelectionRepository(),
      fileExists: defaultFileExists,
      isExecutable: defaultIsExecutable,
      resolveLlmServerPath: resolveDefaultLlmServerPath,
      ...deps
    };
  }

  async sendMessage(
    request: SendChatMessageRequest,
    emitToRenderer: (payload: ChatStreamChunkEvent) => void
  ): Promise<SendChatMessageResponse> {
    let settings: LlmRuntimeSettings;
    try {
      settings = await this.deps.llmSettingsRepository.getRuntimeSettings();
    } catch (error) {
      throw new AppException({
        code: 'LLM_SETTINGS_LOAD_FAILED',
        userMessage: 'Could not load LLM runtime settings.',
        details: error
      });
    }

    let notReadyDetails = await getLlmNotReadyDetails(settings, {
      fileExists: this.deps.fileExists,
      isExecutable: this.deps.isExecutable
    });

    if (notReadyDetails && canRecoverServerPathIssues(notReadyDetails)) {
      const activeModel = await this.deps.llmSelectionRepository.getActiveModel();
      if (activeModel) {
        const reset = await this.deps.llmSelectionRepository.resetSettingsToDefaults(this.deps.resolveLlmServerPath());
        if (reset?.settings) {
          settings = reset.settings;
          notReadyDetails = await getLlmNotReadyDetails(settings, {
            fileExists: this.deps.fileExists,
            isExecutable: this.deps.isExecutable
          });
        }
      }
    }

    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }

    const resolvedSessionId = resolveSessionId(request);
    const llmPayload: LlmChatPayload = {
      ...request,
      sessionId: resolvedSessionId,
      settings
    };

    if (resolvedSessionId) {
      try {
        llmPayload.sessionTurns = await this.deps.llmChatSessionRepository.listRecentTurns(resolvedSessionId);
      } catch (error) {
        throw new AppException({
          code: 'CHAT_SESSION_LOAD_FAILED',
          userMessage: 'Could not load chat session context.',
          details: error
        });
      }
    }

    const clientRequestId = request.clientRequestId ?? randomUUID();
    const llmResult = await this.deps.llmOrchestrator.requestActionStream<LlmChatPayload, SendChatMessageResponse>(
      'llm.chatStream',
      llmPayload,
      (streamEvent) => {
        const mappedType =
          streamEvent.type === 'stream_start'
            ? 'start'
            : streamEvent.type === 'stream_chunk'
              ? 'chunk'
              : streamEvent.type === 'stream_done'
                ? 'done'
                : 'error';
        emitToRenderer({
          requestId: streamEvent.requestId,
          clientRequestId: streamEvent.data.clientRequestId ?? clientRequestId,
          fileId: request.fileId,
          type: mappedType,
          seq: streamEvent.data.seq,
          channel: streamEvent.data.channel,
          text: streamEvent.data.text,
          done: streamEvent.data.done,
          error: streamEvent.data.error
        });
      }
    );

    if (!llmResult.ok) {
      throw new AppException({
        code: llmResult.error.code,
        userMessage: llmResult.error.message,
        details: llmResult.error.details
      });
    }

    const reply = getReplyText(llmResult.data);
    if (!reply) {
      throw new AppException({
        code: 'PY_INVALID_RESPONSE',
        userMessage: 'Python worker returned chat success without a valid reply.',
        details: llmResult.data
      });
    }

    const createdAt = new Date().toISOString();
    try {
      if (resolvedSessionId) {
        await this.deps.llmChatSessionRepository.appendTurnPair(
          resolvedSessionId,
          request.message,
          reply,
          request.fileId
        );
      }
      await this.deps.repository.addMessage({
        id: randomUUID(),
        role: 'teacher',
        content: request.message,
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
