import type { IpcMainLike } from '../types';

export const LLM_MANAGER_CHANNELS = {} as const;

export function registerLlmManagerHandlers(ipc: IpcMainLike): void {
  // Implemented in Phase 3 — VS5 LLM Manager Backend
  void ipc;
}
