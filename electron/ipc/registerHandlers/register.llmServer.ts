import type { IpcMainLike } from '../types';

export const LLM_SERVER_CHANNELS = {} as const;

export interface LlmServerHandlerDeps {
  llmOrchestrator: unknown;
}

export function registerLlmServerHandlers(ipc: IpcMainLike, deps: LlmServerHandlerDeps): void {
  // Implemented in Phase 3 — VS5 LLM Server Backend
  void ipc;
  void deps;
}
