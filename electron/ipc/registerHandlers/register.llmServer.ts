import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { AppException } from '../../core/appException';
import {
  StartLlmServerSchema,
  StopLlmServerSchema,
  GetLlmServerStatusSchema
} from '../validationSchemas/llmServer.schemas';
import type {
  StartLlmServerResponse,
  StopLlmServerResponse,
  GetLlmServerStatusResponse
} from '../contracts/llmServer.contracts';
import { LlmSettingsRepository } from '../../db/repositories/llmSettingsRepository';
import type { LlmOrchestrator } from '../../services/llm/llmOrchestrator';
import type { LlmRuntimeSettings } from '../../db/repositories/llmSettingsRepository';
import type { IpcMainLike } from '../types';

export const LLM_SERVER_CHANNELS = {
  start: 'llmServer/start',
  stop: 'llmServer/stop',
  status: 'llmServer/status'
} as const;

interface LlmServerHandlerDeps {
  llmOrchestrator: Pick<LlmOrchestrator, 'requestAction'>;
  llmSettingsRepository: Pick<LlmSettingsRepository, 'getRuntimeSettings'>;
}

function getDefaultDeps(): Partial<LlmServerHandlerDeps> {
  return {
    llmSettingsRepository: new LlmSettingsRepository()
  };
}

export function registerLlmServerHandlers(
  ipcMain: IpcMainLike,
  deps: Partial<LlmServerHandlerDeps> = {}
): void {
  const resolvedDeps = {
    ...getDefaultDeps(),
    ...deps
  } as LlmServerHandlerDeps;

  if (!resolvedDeps.llmOrchestrator) {
    throw new Error('llmOrchestrator is required for LLM server handlers');
  }

  safeHandle(ipcMain, LLM_SERVER_CHANNELS.start, async (payload, ctx) => {
    validateOrThrow(StartLlmServerSchema, payload);
    let settings: LlmRuntimeSettings;
    try {
      settings = await resolvedDeps.llmSettingsRepository.getRuntimeSettings();
    } catch (error) {
      throw new AppException({
        code: 'LLM_SERVER_SETTINGS_LOAD_FAILED',
        userMessage: 'Could not load LLM runtime settings.',
        details: error
      });
    }

    const result = await resolvedDeps.llmOrchestrator.requestAction<{ settings: LlmRuntimeSettings }, StartLlmServerResponse>(
      'llm.server.start',
      { settings }
    );
    if (!result.ok) {
      throw new AppException({
        code: result.error.code,
        userMessage: result.error.message,
        details: result.error.details
      });
    }
    return result.data;
  });

  safeHandle(ipcMain, LLM_SERVER_CHANNELS.stop, async (payload, ctx) => {
    validateOrThrow(StopLlmServerSchema, payload);
    const result = await resolvedDeps.llmOrchestrator.requestAction<{}, StopLlmServerResponse>('llm.server.stop', {});
    if (!result.ok) {
      throw new AppException({
        code: result.error.code,
        userMessage: result.error.message,
        details: result.error.details
      });
    }
    return result.data;
  });

  safeHandle(ipcMain, LLM_SERVER_CHANNELS.status, async (payload, ctx) => {
    validateOrThrow(GetLlmServerStatusSchema, payload);
    const result = await resolvedDeps.llmOrchestrator.requestAction<{}, GetLlmServerStatusResponse>('llm.server.status', {});
    if (!result.ok) {
      throw new AppException({
        code: result.error.code,
        userMessage: result.error.message,
        details: result.error.details
      });
    }
    return result.data;
  });
}
