import type { DownloadProgressEvent, LlmManagerPort } from '@/app/ports/llmManager.port';

type LlmApi = LlmManagerPort;

function getLlmManagerApi(): LlmApi {
  const appWindow = window as Window & { api?: { llmManager?: LlmApi } };
  if (!appWindow.api?.llmManager) {
    throw new Error('window.api.llmManager is not available.');
  }
  return appWindow.api.llmManager;
}

function hasLlmManagerApi(): boolean {
  const appWindow = window as Window & { api?: { llmManager?: unknown } };
  return Boolean(appWindow.api?.llmManager);
}

export function createElectronLlmManagerAdapter(): LlmManagerPort {
  return {
    isAvailable: () => hasLlmManagerApi(),
    supportsDownload: () => {
      if (!hasLlmManagerApi()) {
        return false;
      }
      const api = getLlmManagerApi() as unknown as Record<string, unknown>;
      return typeof api['downloadModel'] === 'function';
    },
    listCatalogModels: () => getLlmManagerApi().listCatalogModels(),
    listDownloadedModels: () => getLlmManagerApi().listDownloadedModels(),
    getActiveModel: () => getLlmManagerApi().getActiveModel(),
    downloadModel: (request) => getLlmManagerApi().downloadModel(request),
    deleteDownloadedModel: (request) => getLlmManagerApi().deleteDownloadedModel(request),
    onDownloadProgress: (listener) => {
      if (!hasLlmManagerApi()) {
        return () => {};
      }
      const api = getLlmManagerApi() as unknown as Record<string, unknown>;
      if (typeof api['onDownloadProgress'] !== 'function') {
        return () => {};
      }
      return (api['onDownloadProgress'] as (l: (event: DownloadProgressEvent) => void) => () => void)(listener);
    },
    selectModel: (request) => getLlmManagerApi().selectModel(request),
    getSettings: () => getLlmManagerApi().getSettings(),
    updateSettings: (request) => getLlmManagerApi().updateSettings(request),
    resetSettingsToDefaults: () => getLlmManagerApi().resetSettingsToDefaults()
  };
}
