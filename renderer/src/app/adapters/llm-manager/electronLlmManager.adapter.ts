import { invokeRequest } from '@/app/invokeRequest';
import type { DownloadProgressEvent, LlmManagerPort } from '@/app/ports/llmManager.port';

function hasLlmManagerApi(): boolean {
  const appWindow = window as Window & { api?: { llmManager?: unknown } };
  return Boolean(appWindow.api?.llmManager);
}

export function createElectronLlmManagerAdapter(): LlmManagerPort {
  return {
    isAvailable: () => hasLlmManagerApi(),
    supportsDownload: () => hasLlmManagerApi(), // Simplified as we expect download to be available if api is
    listCatalogModels: () => invokeRequest('llmManager/listCatalogModels'),
    listDownloadedModels: () => invokeRequest('llmManager/listDownloadedModels'),
    getActiveModel: () => invokeRequest('llmManager/getActiveModel'),
    downloadModel: (request) => invokeRequest('llmManager/downloadModel', request),
    deleteDownloadedModel: (request) => invokeRequest('llmManager/deleteDownloadedModel', request),
    onDownloadProgress: (listener) => {
      const appWindow = window as any;
      if (typeof appWindow.api?.llmManager?.onDownloadProgress === 'function') {
        return appWindow.api.llmManager.onDownloadProgress(listener);
      }
      return () => {};
    },
    selectModel: (request) => invokeRequest('llmManager/selectModel', request),
    getSettings: () => invokeRequest('llmManager/getSettings'),
    updateSettings: (request) => invokeRequest('llmManager/updateSettings', request),
    resetSettingsToDefaults: () => invokeRequest('llmManager/resetSettingsToDefaults')
  };
}
