import type { IpcMainLike } from '../types';

export const CHAT_CHANNELS = {} as const;

export interface ChatHandlerDeps {
  llmOrchestrator: unknown;
}

export function registerChatHandlers(ipc: IpcMainLike, deps: ChatHandlerDeps): void {
  // Implemented in Phase 3 — VS4 Chat Backend
  void ipc;
  void deps;
}
