import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import {
  CreateLlmSessionSchema,
  ClearLlmSessionSchema,
  DeleteLlmSessionSchema,
  GetLlmSessionTurnsSchema,
  ListLlmSessionsByFileSchema
} from '../validationSchemas/llmSession.schemas';
import type {
  CreateLlmSessionResponse,
  ClearLlmSessionResponse,
  DeleteLlmSessionResponse,
  ListLlmSessionsByFileResponse,
  GetLlmSessionTurnsResponse
} from '../contracts/llmSession.contracts';
import { LlmChatSessionRepository } from '../../db/repositories/llmChatSessionRepository';
import type { LlmOrchestrator } from '../../services/llm/llmOrchestrator';
import type { IpcMainLike } from '../types';

export const LLM_SESSION_CHANNELS = {
  create: 'llmSession/create',
  clear: 'llmSession/clear',
  delete: 'llmSession/delete',
  getTurns: 'llmSession/getTurns',
  listByFile: 'llmSession/listByFile'
} as const;

interface LlmSessionHandlerDeps {
  llmChatSessionRepository: Pick<
    LlmChatSessionRepository,
    'createSession' | 'clearSession' | 'deleteSession' | 'listRecentTurns' | 'listSessionsByFile'
  >;
  llmOrchestrator: Pick<LlmOrchestrator, 'requestAction'>;
}

function getDefaultDeps(): Partial<LlmSessionHandlerDeps> {
  return {
    llmChatSessionRepository: new LlmChatSessionRepository()
  };
}

async function clearSimpleChatSessionCache(
  llmOrchestrator: Pick<LlmOrchestrator, 'requestAction'>,
  sessionId: string
): Promise<void> {
  const cacheClearResult = await llmOrchestrator.requestAction<
    { sessionId: string },
    { sessionId: string; cleared: boolean }
  >('llm.simpleChat.clearSessionCache', { sessionId });
  if (!cacheClearResult.ok) {
    throw new Error(cacheClearResult.error.message || 'Could not clear simple-chat session cache.');
  }
}

export function registerLlmSessionHandlers(
  ipcMain: IpcMainLike,
  deps: Partial<LlmSessionHandlerDeps> = {}
): void {
  const resolvedDeps = {
    ...getDefaultDeps(),
    ...deps
  } as LlmSessionHandlerDeps;

  if (!resolvedDeps.llmOrchestrator) {
     throw new Error('LlmOrchestrator is required for LLM session handlers');
  }

  safeHandle(ipcMain, LLM_SESSION_CHANNELS.create, async (payload, ctx) => {
    const data = validateOrThrow(CreateLlmSessionSchema, payload);
    const created = await resolvedDeps.llmChatSessionRepository.createSession(
      data.sessionId,
      data.fileEntityUuid
    );
    return created as CreateLlmSessionResponse;
  });

  safeHandle(ipcMain, LLM_SESSION_CHANNELS.clear, async (payload, ctx) => {
    const data = validateOrThrow(ClearLlmSessionSchema, payload);
    await clearSimpleChatSessionCache(resolvedDeps.llmOrchestrator, data.sessionId);
    const cleared = await resolvedDeps.llmChatSessionRepository.clearSession(data.sessionId);
    return cleared as ClearLlmSessionResponse;
  });

  safeHandle(ipcMain, LLM_SESSION_CHANNELS.delete, async (payload, ctx) => {
    const data = validateOrThrow(DeleteLlmSessionSchema, payload);
    await clearSimpleChatSessionCache(resolvedDeps.llmOrchestrator, data.sessionId);
    const deleted = await resolvedDeps.llmChatSessionRepository.deleteSession(data.sessionId);
    return deleted as DeleteLlmSessionResponse;
  });

  safeHandle(ipcMain, LLM_SESSION_CHANNELS.getTurns, async (payload, ctx) => {
    const data = validateOrThrow(GetLlmSessionTurnsSchema, payload);
    const turns = await resolvedDeps.llmChatSessionRepository.listRecentTurns(data.sessionId, data.fileEntityUuid);
    const result: GetLlmSessionTurnsResponse = {
      sessionId: data.sessionId,
      fileEntityUuid: data.fileEntityUuid,
      turns: turns.map((turn) => ({
        role: turn.role,
        content: turn.content,
        feedbackType: turn.metadata?.feedbackType,
        vocabulary: turn.metadata?.vocabulary
      }))
    };
    return result;
  });

  safeHandle(ipcMain, LLM_SESSION_CHANNELS.listByFile, async (payload, ctx) => {
    const data = validateOrThrow(ListLlmSessionsByFileSchema, payload);
    const sessions = await resolvedDeps.llmChatSessionRepository.listSessionsByFile(data.fileEntityUuid);
    const result: ListLlmSessionsByFileResponse = {
      fileEntityUuid: data.fileEntityUuid,
      sessions
    };
    return result;
  });
}
