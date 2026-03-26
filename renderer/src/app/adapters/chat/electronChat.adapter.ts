import { invokeRequest } from '@/app/invokeRequest';
import type { 
  ChatPort, 
  ChatStreamChunkEvent, 
  ListMessagesResponse, 
  SendChatMessageRequest, 
  SendChatMessageResponse 
} from '@/app/ports/chat.port';

const CHANNELS = {
  listMessages: 'chat/listMessages',
  sendMessage: 'chat/sendMessage'
} as const;

const EVENTS = {
  streamChunk: 'chat/streamChunk'
} as const;

function getElectronChatApi() {
  const appWindow = window as Window & {
    api?: {
      chat?: {
        onStreamChunk?: (eventListener: (event: any) => void) => () => void;
      };
    };
  };
  return appWindow.api?.chat;
}

export function createElectronChatAdapter(): ChatPort {
  return {
    listMessages: (fileId?: string) => invokeRequest<ListMessagesResponse>(CHANNELS.listMessages, { fileId }),
    sendMessage: (request: SendChatMessageRequest) => invokeRequest<SendChatMessageResponse>(CHANNELS.sendMessage, request),
    onStreamChunk: (listener: (event: ChatStreamChunkEvent) => void) => {
      const chatApi = getElectronChatApi();
      if (typeof chatApi?.onStreamChunk !== 'function') {
        return () => {};
      }

      return chatApi.onStreamChunk((rawEvent: any) => {
        const typedEvent: ChatStreamChunkEvent = {
          requestId: rawEvent.requestId,
          clientRequestId: rawEvent.clientRequestId,
          fileId: rawEvent.fileId,
          type: rawEvent.type,
          seq: rawEvent.seq,
          channel: rawEvent.channel,
          text: rawEvent.text,
          done: rawEvent.done,
          error: rawEvent.error
        };
        listener(typedEvent);
      });
    }
  };
}
