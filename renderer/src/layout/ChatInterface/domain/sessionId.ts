export function createTimestampSessionId(fileEntityUuid: string, nowMs: number = Date.now()): string {
  return `simple-chat:${fileEntityUuid}:${nowMs}`;
}

export function resolveSessionIdForSend(fileEntityUuid: string, activeSessionId?: string): string {
  const trimmed = activeSessionId?.trim();
  if (trimmed) {
    return trimmed;
  }
  return `simple-chat:${fileEntityUuid}`;
}
