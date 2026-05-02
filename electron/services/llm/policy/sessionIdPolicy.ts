import type { SendChatMessageRequest } from '../../../ipc/contracts/chat.contracts';

export function resolveSessionId(request: SendChatMessageRequest): string | undefined {
  if (typeof request.sessionId === 'string' && request.sessionId.trim()) {
    return request.sessionId.trim();
  }
  if (typeof request.fileId === 'string' && request.fileId.trim()) {
    return `file:${request.fileId}`;
  }
  return undefined;
}
