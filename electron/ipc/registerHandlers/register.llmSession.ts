import type { IpcMainLike } from '../types';

export const LLM_SESSION_CHANNELS = {} as const;

export interface LlmSessionHandlerDeps {
  llmOrchestrator: unknown;
}

export function registerLlmSessionHandlers(ipc: IpcMainLike, deps: LlmSessionHandlerDeps): void {
  // Implemented in Phase 3 — VS6 LLM Session Backend
  void ipc;
  void deps;
}
