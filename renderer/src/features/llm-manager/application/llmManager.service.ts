import type { AppError } from '@/app/result';
import type { LlmManagerPort } from '@/app/ports/llmManager.port';
import type {
  DeleteDownloadedModelResponse,
  DownloadProgressEvent,
  DownloadedLlmModelDto,
  LlmModelKey,
  LlmRuntimeSettings,
  ResetSettingsToDefaultsResponse,
  SelectModelResponse
} from '@/app/ports/llmManager.port';
import type { LlmCatalogModel } from '../domain/llmManager.types';

function toError(resultError: AppError): Error {
  return new Error(resultError.message || 'LLM manager request failed.');
}

export async function listCatalogModels(port: LlmManagerPort): Promise<LlmCatalogModel[]> {
  if (!port.isAvailable()) {
    return [];
  }
  const result = await port.listCatalogModels();
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.models;
}

export async function listDownloadedModels(port: LlmManagerPort): Promise<DownloadedLlmModelDto[]> {
  const result = await port.listDownloadedModels();
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.models;
}

export async function getActiveModel(port: LlmManagerPort): Promise<DownloadedLlmModelDto | null> {
  const result = await port.getActiveModel();
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.model;
}

export async function selectModel(port: LlmManagerPort, key: LlmModelKey): Promise<SelectModelResponse> {
  const result = await port.selectModel({ key });
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data;
}

export async function getSettings(port: LlmManagerPort): Promise<LlmRuntimeSettings> {
  const result = await port.getSettings();
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.settings;
}

export async function updateSettings(
  port: LlmManagerPort,
  settings: Partial<LlmRuntimeSettings>
): Promise<LlmRuntimeSettings> {
  const result = await port.updateSettings({ settings });
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.settings;
}

export async function resetSettingsToDefaults(port: LlmManagerPort): Promise<ResetSettingsToDefaultsResponse> {
  const result = await port.resetSettingsToDefaults();
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data;
}

export async function downloadModel(port: LlmManagerPort, key: LlmModelKey): Promise<DownloadedLlmModelDto> {
  if (!port.supportsDownload()) {
    throw new Error('Model download action is not available in this build.');
  }
  const result = await port.downloadModel({ key });
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data.model;
}

export async function deleteDownloadedModel(
  port: LlmManagerPort,
  key: LlmModelKey
): Promise<DeleteDownloadedModelResponse> {
  if (!port.supportsDownload()) {
    throw new Error('Model delete action is not available in this build.');
  }
  const result = await port.deleteDownloadedModel({ key, deleteFiles: true });
  if (!result.ok) {
    throw toError(result.error);
  }
  return result.data;
}

export function subscribeToDownloadProgress(
  port: LlmManagerPort,
  listener: (event: DownloadProgressEvent) => void
): () => void {
  if (!port.isAvailable()) {
    return () => {};
  }
  return port.onDownloadProgress(listener);
}
