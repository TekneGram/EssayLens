import fsPromises from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type {
  ChatStreamChunkEvent,
  SendChatMessageRequest,
  SendChatMessageResponse,
  RubricFeedbackCategoryReplyDto
} from '../../ipc/contracts/chat.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmChatSessionRepository, type LlmSessionTurn } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository, type LlmRuntimeSettings } from '../../db/repositories/llmSettingsRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import { resolveLlamaServerPath } from '../../runtime/runtimePaths';
import { getLlmNotReadyDetails } from '../../runtime/llmRuntimeReadiness';
import type { LlmNotReadyErrorDetails } from '../../ipc/contracts/chat.contracts';
import type { GetRubricGradingContextResponse, GetRubricMatrixResponse } from '../../ipc/contracts/rubric.contracts';

interface ChatServiceDeps {
  repository: ChatRepository;
  llmOrchestrator: LlmOrchestrator;
  llmSettingsRepository: LlmSettingsRepository;
  llmChatSessionRepository: LlmChatSessionRepository;
  llmSelectionRepository: LlmSelectionRepository;
  rubricRepository: RubricRepository;
  fileExists: (targetPath: string) => Promise<boolean>;
  isFile: (targetPath: string) => Promise<boolean>;
  isExecutable: (targetPath: string) => Promise<boolean>;
  resolveLlmServerPath: () => string;
}

interface LlmChatPayload extends SendChatMessageRequest {
  sessionTurns?: LlmSessionTurn[];
  settings: LlmRuntimeSettings;
  systemPrompt?: string;
}

interface LlmRubricEvaluationPayload {
  settings: LlmRuntimeSettings;
  essay: string;
  rubricCategory: string;
  rubricEntries: RubricFeedbackCategorySection['entries'];
}

interface RubricFeedbackCategorySection {
  category: string;
  entries: Array<{
    scoreValue: number;
    description: string;
  }>;
}

interface RuntimeReadyResult {
  settings: LlmRuntimeSettings;
  notReadyDetails: LlmNotReadyErrorDetails | null;
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

async function defaultIsFile(targetPath: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(targetPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

function resolveDefaultLlmServerPath(): string {
  const runtimeMode = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' ? 'dev' : 'packaged';
  return resolveLlamaServerPath({ mode: runtimeMode });
}

function canRecoverServerPathIssues(details: LlmNotReadyErrorDetails): boolean {
  const recoverableCodes = new Set([
    'MISSING_SERVER_PATH',
    'SERVER_FILE_NOT_FOUND',
    'SERVER_PATH_NOT_FILE',
    'SERVER_NOT_EXECUTABLE'
  ]);
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

function isRubricFeedbackRequest(request: SendChatMessageRequest): request is SendChatMessageRequest & {
  kind: 'rubric-feedback';
  fileId: string;
  essay: string;
} {
  return request.kind === 'rubric-feedback';
}

function resolveRubricFeedbackSessionId(request: SendChatMessageRequest & { kind: 'rubric-feedback'; fileId: string }): string {
  if (typeof request.sessionId === 'string' && request.sessionId.trim()) {
    return request.sessionId.trim();
  }
  return `rubric-feedback:${request.fileId}:${randomUUID()}`;
}

function requireChatMessage(request: SendChatMessageRequest): string {
  const message = typeof request.message === 'string' ? request.message.trim() : '';
  if (!message) {
    throw new AppException({
      code: 'CHAT_INVALID_REQUEST',
      userMessage: 'Chat requests require a non-empty message.'
    });
  }
  return message;
}

function slugifyCategory(category: string): string {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'category';
}

function normalizeRubricSections(matrix: GetRubricMatrixResponse): RubricFeedbackCategorySection[] {
  const scoreByDetailId = new Map<string, number>();
  for (const score of matrix.scores) {
    scoreByDetailId.set(score.detailsUuid, score.scoreValues);
  }

  const sections = new Map<string, RubricFeedbackCategorySection>();
  for (const detail of matrix.details) {
    const scoreValue = scoreByDetailId.get(detail.uuid);
    if (scoreValue === undefined) {
      continue;
    }

    const existing = sections.get(detail.category);
    if (existing) {
      existing.entries.push({
        scoreValue,
        description: detail.description
      });
      continue;
    }

    sections.set(detail.category, {
      category: detail.category,
      entries: [
        {
          scoreValue,
          description: detail.description
        }
      ]
    });
  }

  return [...sections.values()].map((section) => ({
    ...section,
    entries: [...section.entries].sort((left, right) => right.scoreValue - left.scoreValue || left.description.localeCompare(right.description))
  }));
}

export class ChatService {
  private readonly deps: ChatServiceDeps;

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
  }

  async sendMessage(
    request: SendChatMessageRequest,
    emitToRenderer: (payload: ChatStreamChunkEvent) => void
  ): Promise<SendChatMessageResponse> {
    if (isRubricFeedbackRequest(request)) {
      return this.sendRubricFeedbackMessage(request, emitToRenderer);
    }
    return this.sendPlainChatMessage(request, emitToRenderer);
  }

  private async sendPlainChatMessage(
    request: SendChatMessageRequest,
    emitToRenderer: (payload: ChatStreamChunkEvent) => void
  ): Promise<SendChatMessageResponse> {
    const { settings, notReadyDetails } = await this.getRuntimeReadyResult();
    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }

    return this.runPlainChatRequest(request, settings, emitToRenderer);
  }

  private async runPlainChatRequest(
    request: SendChatMessageRequest,
    settings: LlmRuntimeSettings,
    emitToRenderer: (payload: ChatStreamChunkEvent) => void
  ): Promise<SendChatMessageResponse> {
    const message = requireChatMessage(request);
    const resolvedSessionId = resolveSessionId(request);
    const llmPayload: LlmChatPayload = {
      ...request,
      message,
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
          sessionId: resolvedSessionId,
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

  private async sendRubricFeedbackMessage(
    request: SendChatMessageRequest & { kind: 'rubric-feedback'; fileId: string; essay: string },
    emitToRenderer: (payload: ChatStreamChunkEvent) => void
  ): Promise<SendChatMessageResponse> {
    const { settings, notReadyDetails } = await this.getRuntimeReadyResult();
    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }
    const rubricId = await this.resolveRubricIdForFeedback(request);
    const matrix = await this.loadRubricMatrix(rubricId);
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

      const llmResult = await this.deps.llmOrchestrator.requestAction<LlmRubricEvaluationPayload, SendChatMessageResponse>(
        'llm.evaluate.withRubric',
        {
          settings,
          essay: request.essay,
          rubricCategory: section.category,
          rubricEntries: section.entries
        }
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

      const reply = getReplyText(llmResult.data);
      if (!reply) {
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
            code: 'PY_INVALID_RESPONSE',
            message: 'Python worker returned rubric feedback success without a valid reply.',
            details: llmResult.data
          }
        });
        throw new AppException({
          code: 'PY_INVALID_RESPONSE',
          userMessage: 'Python worker returned rubric feedback success without a valid reply.',
          details: llmResult.data
        });
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

      await this.persistRubricFeedbackReply({
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

  private async persistRubricFeedbackReply(args: {
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

  private async resolveRubricIdForFeedback(
    request: SendChatMessageRequest & { kind: 'rubric-feedback'; fileId: string; rubricId?: string }
  ): Promise<string> {
    if (typeof request.rubricId === 'string' && request.rubricId.trim()) {
      return request.rubricId.trim();
    }

    let context: GetRubricGradingContextResponse;
    try {
      context = await this.deps.rubricRepository.getRubricGradingContext(request.fileId);
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_GET_GRADING_CONTEXT_FAILED',
        userMessage: 'Could not resolve the rubric for rubric feedback.',
        details: error
      });
    }

    const resolvedRubricId = context.selectedRubricIdForFile ?? context.lockedRubricId;
    if (resolvedRubricId) {
      return resolvedRubricId;
    }

    throw new AppException({
      code: 'RUBRIC_FEEDBACK_NO_SELECTED_RUBRIC',
      userMessage: 'Select a rubric before requesting rubric-based comments.',
      details: context
    });
  }

  private async loadRubricMatrix(rubricId: string): Promise<GetRubricMatrixResponse> {
    try {
      const matrix = await this.deps.rubricRepository.getRubricMatrix(rubricId);
      if (!matrix) {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${rubricId}.`
        });
      }
      return matrix;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException({
        code: 'RUBRIC_GET_MATRIX_FAILED',
        userMessage: 'Could not load rubric matrix.',
        details: error
      });
    }
  }

  private async loadRuntimeSettings(): Promise<LlmRuntimeSettings> {
    try {
      return await this.deps.llmSettingsRepository.getRuntimeSettings();
    } catch (error) {
      throw new AppException({
        code: 'LLM_SETTINGS_LOAD_FAILED',
        userMessage: 'Could not load LLM runtime settings.',
        details: error
      });
    }
  }

  private async getRuntimeReadyResult(): Promise<RuntimeReadyResult> {
    let settings = await this.loadRuntimeSettings();
    let notReadyDetails = await getLlmNotReadyDetails(settings, {
      fileExists: this.deps.fileExists,
      isFile: this.deps.isFile,
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
            isFile: this.deps.isFile,
            isExecutable: this.deps.isExecutable
          });
        }
      }
    }

    return {
      settings,
      notReadyDetails
    };
  }
}
