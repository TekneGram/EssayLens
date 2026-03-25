import type { IpcMainLike } from '../types';

export const WORKSPACE_CHANNELS = {} as const;

export function registerWorkspaceHandlers(ipc: IpcMainLike): void {
  // Implemented in Phase 3 — VS2 Workspace Backend
  void ipc;
}
