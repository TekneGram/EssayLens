import type { ChatStreamChunkEvent } from '../ipc/contracts/chat.contracts';
import type { SendChatMessageRequest } from '../ipc/contracts/chat.contracts';
import type { PythonStreamEventEnvelope } from '../services/llm/llm.contracts';

export function mapPythonStreamEventToChatChunkEvent(args: {
  streamEvent: PythonStreamEventEnvelope;
  request: SendChatMessageRequest;
  sessionId?: string;
  clientRequestId: string;
}): ChatStreamChunkEvent {
  const { streamEvent, request, sessionId, clientRequestId } = args;
  const mappedType =
    streamEvent.type === 'stream_start'
      ? 'start'
      : streamEvent.type === 'stream_status'
        ? 'status'
        : streamEvent.type === 'stream_chunk'
          ? 'chunk'
          : streamEvent.type === 'stream_done'
            ? 'done'
            : 'error';

  return {
    requestId: streamEvent.requestId,
    clientRequestId: streamEvent.data.clientRequestId ?? clientRequestId,
    fileId: request.fileId,
    sessionId,
    type: mappedType,
    seq: streamEvent.data.seq,
    channel: streamEvent.data.channel,
    text: streamEvent.data.text,
    done: streamEvent.data.done,
    error: streamEvent.data.error
  };
}
