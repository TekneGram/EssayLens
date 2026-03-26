import { ASSESSMENT_CHANNELS, registerAssessmentHandlers } from './registerHandlers/register.assessment';
import { CHAT_CHANNELS, registerChatHandlers } from './registerHandlers/register.chat';
import { LLM_MANAGER_CHANNELS, registerLlmManagerHandlers } from './registerHandlers/register.llmManager';
import { LLM_SERVER_CHANNELS, registerLlmServerHandlers } from './registerHandlers/register.llmServer';
import { LLM_SESSION_CHANNELS, registerLlmSessionHandlers } from './registerHandlers/register.llmSession';
import { RUBRIC_CHANNELS, registerRubricHandlers } from './registerHandlers/register.rubric';
import { LlmOrchestrator } from '../services/llm/llmOrchestrator';
import { PythonWorkerClient } from '../infrastructure/adapters/pythonWorkerAdapter';
import type { IpcMainLike } from './types';
import { WORKSPACE_CHANNELS, registerWorkspaceHandlers } from './registerHandlers/register.workspace';

export const ALL_IPC_CHANNELS = [
  ...Object.values(WORKSPACE_CHANNELS),
  ...Object.values(ASSESSMENT_CHANNELS),
  ...Object.values(RUBRIC_CHANNELS),
  ...Object.values(CHAT_CHANNELS),
  ...Object.values(LLM_MANAGER_CHANNELS),
  ...Object.values(LLM_SERVER_CHANNELS),
  ...Object.values(LLM_SESSION_CHANNELS)
] as readonly string[];

let sharedLlmOrchestrator: LlmOrchestrator | null = null;

function getSharedLlmOrchestrator(): LlmOrchestrator {
  if (!sharedLlmOrchestrator) {
    sharedLlmOrchestrator = new LlmOrchestrator({
      workerClient: new PythonWorkerClient()
    });
  }
  return sharedLlmOrchestrator;
}

export async function shutdownSharedLlmRuntime(): Promise<void> {
  if (!sharedLlmOrchestrator) {
    return;
  }
  try {
    await sharedLlmOrchestrator.requestAction('llm.server.stop', {});
  } catch {
    // Ignore stop failures during app teardown.
  } finally {
    sharedLlmOrchestrator.shutdown();
    sharedLlmOrchestrator = null;
  }
}

export function registerIpcHandlers(ipcMain: IpcMainLike): readonly string[] {
  const llmOrchestrator = getSharedLlmOrchestrator();
  registerWorkspaceHandlers(ipcMain);
  registerAssessmentHandlers(ipcMain);
  registerRubricHandlers(ipcMain);
  registerChatHandlers(ipcMain, { llmOrchestrator });
  registerLlmManagerHandlers(ipcMain);
  registerLlmServerHandlers(ipcMain, { llmOrchestrator });
  registerLlmSessionHandlers(ipcMain, { llmOrchestrator });
  return ALL_IPC_CHANNELS;
}
