import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export function createPreloadApi() {
  return {
    // The generic invoke Request handler used by almost all refactored adapters
    invoke: (channel: string, payload?: unknown) => ipcRenderer.invoke(channel, payload),
    
    // Legacy structured adapters used by event streams
    chat: {
      onStreamChunk: (listener: (event: any) => void) => {
        const channel = 'chat/streamChunk';
        const wrappedListener = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
        ipcRenderer.on(channel, wrappedListener);
        return () => {
          if (typeof ipcRenderer.removeListener === 'function') {
            ipcRenderer.removeListener(channel, wrappedListener);
          }
        };
      }
    },
    llmManager: {
      onDownloadProgress: (listener: (event: any) => void) => {
        const channel = 'llmManager/downloadProgress';
        const wrappedListener = (_event: IpcRendererEvent, payload: unknown) => listener(payload);
        ipcRenderer.on(channel, wrappedListener);
        return () => {
          if (typeof ipcRenderer.removeListener === 'function') {
            ipcRenderer.removeListener(channel, wrappedListener);
          }
        };
      }
    }
  };
}

if (!process.env.VITEST) {
  contextBridge.exposeInMainWorld('api', createPreloadApi());
}
