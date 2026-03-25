import type { ChatPort, ChatStreamChunkEvent } from '@/app/ports/chat.port';

function getElectronChatApi(): ChatPort {
  const appWindow = window as Window & { api?: { chat?: ChatPort } };
  if (!appWindow.api?.chat) {
    throw new Error('window.api.chat is not available.');
  }

  return appWindow.api.chat;
}

export function createElectronChatAdapter(): ChatPort {
  return {
    listMessages: (fileId) => getElectronChatApi().listMessages(fileId),
    sendMessage: (request) => getElectronChatApi().sendMessage(request),
    onStreamChunk: (listener) => {
      const chatApi = getElectronChatApi() as ChatPort & {
        onStreamChunk?: (eventListener: (event: ChatStreamChunkEvent) => void) => () => void;
      };
      if (typeof chatApi.onStreamChunk !== 'function') {
        return () => {};
      }

      return chatApi.onStreamChunk(listener);
    }
  };
}
