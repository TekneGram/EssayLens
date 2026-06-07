import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { appErr, appOk } from '../../core/appResult';
import { AppException } from '../../core/appException';
import type {
  DeleteDownloadedModelRequest,
  DeleteDownloadedModelResponse,
  DownloadModelRequest,
  DownloadProgressEvent,
  DownloadModelResponse,
  GetActiveModelResponse,
  GetSettingsResponse,
  ListCatalogModelsResponse,
  ListDownloadedModelsResponse,
  LlmModelKey,
  LlmRuntimeSettings,
  ResetSettingsToDefaultsResponse,
  SelectModelRequest,
  SelectModelResponse,
  UpdateSettingsRequest,
  UpdateSettingsResponse
} from '../contracts/llmManager.contracts';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository } from '../../db/repositories/llmSettingsRepository';
import { downloadModelFile } from '../../services/llm/llmModelDownloader';
import { resolveAssetPath, resolveLlamaServerPath } from '../../runtime/runtimePaths';
import type { IpcMainLike } from '../types';
import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { llmManagerSchemas } from '../validationSchemas/llmManager.schemas';

export const LLM_MANAGER_CHANNELS = {
  listCatalogModels: 'llmManager/listCatalogModels',
  listDownloadedModels: 'llmManager/listDownloadedModels',
  getActiveModel: 'llmManager/getActiveModel',
  downloadModel: 'llmManager/downloadModel',
  deleteDownloadedModel: 'llmManager/deleteDownloadedModel',
  selectModel: 'llmManager/selectModel',
  getSettings: 'llmManager/getSettings',
  updateSettings: 'llmManager/updateSettings',
  resetSettingsToDefaults: 'llmManager/resetSettingsToDefaults'
} as const;

export const LLM_MANAGER_EVENTS = {
  downloadProgress: 'llmManager/downloadProgress'
} as const;

interface LlmManagerHandlerDeps {
  selectionRepository: Pick<
    LlmSelectionRepository,
    | 'listCatalogModels'
    | 'listDownloadedModels'
    | 'getActiveModel'
    | 'selectModel'
    | 'resetSettingsToDefaults'
    | 'upsertDownloadedModel'
    | 'getDownloadedModelByKey'
    | 'deleteDownloadedModel'
  >;
  settingsRepository: Pick<LlmSettingsRepository, 'getRuntimeSettings' | 'updateRuntimeSettings'>;
  downloadModel: (request: {
    key: LlmModelKey;
    hfRepoId: string;
    hfFilename: string;
    onProgress?: (event: DownloadProgressEvent) => void;
  }) => Promise<string>;
  fileExists?: (targetPath: string) => Promise<boolean>;
  removePath?: (targetPath: string) => Promise<void>;
  resolveLlmServerPath?: () => string;
  resolveLlmAssetPath?: (assetRelativePath: string) => string;
}

function resolveDefaultLlmServerPath(): string {
  const runtimeMode = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' ? 'dev' : 'packaged';
  return resolveLlamaServerPath({ mode: runtimeMode });
}

function resolveDefaultLlmAssetPath(assetRelativePath: string): string {
  const runtimeMode = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' ? 'dev' : 'packaged';
  return resolveAssetPath({ mode: runtimeMode, assetRelativePath });
}

function isUnsetLlmServerPath(value: string): boolean {
  const normalized = value.trim();
  return normalized.length === 0 || normalized === '__unset_llm_server__';
}

function getDefaultDeps(): LlmManagerHandlerDeps {
  const selectionRepository = new LlmSelectionRepository();
  return {
    selectionRepository,
    settingsRepository: new LlmSettingsRepository(),
    downloadModel: downloadModelFile,
    fileExists: defaultFileExists,
    removePath: defaultRemovePath,
    resolveLlmServerPath: resolveDefaultLlmServerPath,
    resolveLlmAssetPath: resolveDefaultLlmAssetPath
  };
}

function resolveChatTemplatePath(
  model: { chatTemplateAsset: string | null } | null,
  resolver: (assetRelativePath: string) => string
): string | null {
  if (!model?.chatTemplateAsset) {
    return null;
  }
  return resolver(model.chatTemplateAsset);
}

function normalizeOptionalPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function defaultFileExists(targetPath: string): Promise<boolean> {
  try {
    await fsPromises.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function defaultRemovePath(targetPath: string): Promise<void> {
  await fsPromises.rm(targetPath, { recursive: true, force: true });
}

export function registerLlmManagerHandlers(ipcMain: IpcMainLike, deps: LlmManagerHandlerDeps = getDefaultDeps()): void {
  const fileExists = deps.fileExists ?? defaultFileExists;
  const removePath = deps.removePath ?? defaultRemovePath;

  const emitDownloadProgress = (event: unknown, payload: DownloadProgressEvent): void => {
    const sender =
      typeof event === 'object' && event !== null && 'sender' in event
        ? (event as { sender?: { send?: (channel: string, body: unknown) => void } }).sender
        : undefined;
    if (sender && typeof sender.send === 'function') {
      sender.send(LLM_MANAGER_EVENTS.downloadProgress, payload);
    }
  };

  const clearRuntimeModelPaths = async (): Promise<void> => {
    await deps.settingsRepository.updateRuntimeSettings({
      llm_gguf_path: null,
      llm_mmproj_path: null
    });
  };

  const reconcileDownloadedModels = async (): Promise<void> => {
    const downloadedResponse = await deps.selectionRepository.listDownloadedModels();
    const downloaded = Array.isArray(downloadedResponse) ? downloadedResponse : [];
    for (const model of downloaded) {
      const ggufExists = await fileExists(model.localGgufPath);
      const mmprojExists =
        model.localMmprojPath === null ? true : await fileExists(model.localMmprojPath);
      if (ggufExists && mmprojExists) {
        continue;
      }

      const removed = await deps.selectionRepository.deleteDownloadedModel(model.key);
      if (removed?.isActive) {
        await clearRuntimeModelPaths();
      }
    }
  };

  const healLegacyActiveModelSettings = async (): Promise<LlmRuntimeSettings> => {
    const settings = await deps.settingsRepository.getRuntimeSettings();
    const activeModel = await deps.selectionRepository.getActiveModel();
    if (
      !activeModel &&
      !isUnsetLlmServerPath(settings.llm_server_path) &&
      settings.llm_model_family.trim().length > 0
    ) {
      return settings;
    }
    if (!activeModel) {
      return settings;
    }

    const llmServerPath = (deps.resolveLlmServerPath ?? resolveDefaultLlmServerPath)();
    const catalogModels = await deps.selectionRepository.listCatalogModels();
    const activeCatalogModel = catalogModels.find((model) => model.key === activeModel.key) ?? null;
    const llmChatTemplatePath = resolveChatTemplatePath(
      activeCatalogModel,
      deps.resolveLlmAssetPath ?? resolveDefaultLlmAssetPath
    );
    const hasServerPathIssue = isUnsetLlmServerPath(settings.llm_server_path);
    const hasModelFamilyIssue = settings.llm_model_family.trim().length === 0;
    const currentChatTemplatePath = normalizeOptionalPath(settings.llm_chat_template_path);
    const hasChatTemplateIssue = currentChatTemplatePath !== llmChatTemplatePath;
    if (!hasServerPathIssue && !hasModelFamilyIssue && !hasChatTemplateIssue) {
      return settings;
    }
    const reset = await deps.selectionRepository.resetSettingsToDefaults(llmServerPath, llmChatTemplatePath);
    return reset?.settings ?? settings;
  };

  // --- safeHandle handlers: return plain response objects, throw AppException on error ---

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.listCatalogModels, async () => {
    const models = await deps.selectionRepository.listCatalogModels();
    return { models } as ListCatalogModelsResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.listDownloadedModels, async () => {
    await reconcileDownloadedModels();
    const models = await deps.selectionRepository.listDownloadedModels();
    return { models } as ListDownloadedModelsResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.getActiveModel, async () => {
    await reconcileDownloadedModels();
    const model = await deps.selectionRepository.getActiveModel();
    return { model } as GetActiveModelResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.deleteDownloadedModel, async (payload, ctx) => {
    const request = validateOrThrow(llmManagerSchemas.deleteDownloadedModel, payload);

    const existing = await deps.selectionRepository.getDownloadedModelByKey(request.key);
    if (!existing) {
      throw new AppException({
        code: 'LLM_MANAGER_DELETE_MODEL_NOT_FOUND',
        userMessage: 'The selected model is not currently downloaded.'
      });
    }

    let removedFromDisk = false;
    if (request.deleteFiles !== false) {
      try {
        await removePath(existing.localGgufPath);
        if (existing.localMmprojPath) {
          await removePath(existing.localMmprojPath);
        }
        await removePath(path.dirname(existing.localGgufPath));
        removedFromDisk = true;
      } catch (error) {
        throw new AppException({ code: 'LLM_MANAGER_DELETE_FILE_REMOVE_FAILED', userMessage: 'Could not remove model files from disk.', details: error });
      }
    }

    const deleted = await deps.selectionRepository.deleteDownloadedModel(request.key);
    if (!deleted) {
      throw new AppException({
        code: 'LLM_MANAGER_DELETE_MODEL_NOT_FOUND',
        userMessage: 'The selected model is not currently downloaded.'
      });
    }
    if (deleted.isActive) {
      await clearRuntimeModelPaths();
    }
    return {
      deletedKey: request.key,
      removedFromDisk
    } as DeleteDownloadedModelResponse;
  });

  // Note: We use direct ipcMain.handle for downloadModel because it streams download progress events 
  // to the sender and catches specific partial failures, which doesn't perfectly fit into safeHandle's catch-all.
  ipcMain.handle(LLM_MANAGER_CHANNELS.downloadModel, async (event, payload) => {
    let request;
    try {
      request = validateOrThrow(llmManagerSchemas.downloadModel, payload);
    } catch (e) {
      return appErr({
        code: 'LLM_MANAGER_DOWNLOAD_INVALID_PAYLOAD',
        userMessage: 'Download model payload must include a supported model key.',
        details: e
      });
    }

    let catalogModel: Awaited<ReturnType<typeof deps.selectionRepository.listCatalogModels>>[number] | undefined;
    try {
      const catalogModels = await deps.selectionRepository.listCatalogModels();
      catalogModel = catalogModels.find((model) => model.key === request.key);
    } catch (error) {
      return appErr({
        code: 'LLM_MANAGER_LIST_CATALOG_FAILED',
        userMessage: 'Could not load LLM catalog models.',
        details: error
      });
    }

    if (!catalogModel) {
      return appErr({
        code: 'LLM_MANAGER_DOWNLOAD_MODEL_NOT_FOUND',
        userMessage: 'The requested model key does not exist in the LLM catalog.'
      });
    }

    let localGgufPath: string;
    try {
      localGgufPath = await deps.downloadModel({
        key: catalogModel.key,
        hfRepoId: catalogModel.hfRepoId,
        hfFilename: catalogModel.hfFilename,
        onProgress: (progressEvent) => emitDownloadProgress(event, progressEvent)
      });
    } catch (error) {
      emitDownloadProgress(event, {
        key: catalogModel.key,
        phase: 'failed',
        bytesReceived: 0,
        bytesTotal: null,
        percent: null,
        status: 'Download failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return appErr({
        code: 'LLM_MANAGER_DOWNLOAD_FAILED',
        userMessage: 'Could not download the selected LLM model.',
        details: error
      });
    }

    try {
      emitDownloadProgress(event, {
        key: catalogModel.key,
        phase: 'persisting',
        bytesReceived: 0,
        bytesTotal: null,
        percent: null,
        status: 'Persisting model metadata',
        errorMessage: null
      });
      const model = await deps.selectionRepository.upsertDownloadedModel({
        key: catalogModel.key,
        displayName: catalogModel.displayName,
        localGgufPath,
        localMmprojPath: null
      });
      emitDownloadProgress(event, {
        key: catalogModel.key,
        phase: 'completed',
        bytesReceived: 0,
        bytesTotal: null,
        percent: 100,
        status: 'Model ready',
        errorMessage: null
      });
      return appOk<DownloadModelResponse>({ model });
    } catch (error) {
      emitDownloadProgress(event, {
        key: catalogModel.key,
        phase: 'failed',
        bytesReceived: 0,
        bytesTotal: null,
        percent: null,
        status: 'Persist failed',
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      return appErr({
        code: 'LLM_MANAGER_DOWNLOAD_PERSIST_FAILED',
        userMessage: 'Model download succeeded but could not be persisted.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.selectModel, async (payload, ctx) => {
    const request = validateOrThrow(llmManagerSchemas.selectModel, payload);

    await reconcileDownloadedModels();
    const llmServerPath = (deps.resolveLlmServerPath ?? resolveDefaultLlmServerPath)();
    const catalogModels = await deps.selectionRepository.listCatalogModels();
    const selectedCatalogModel = catalogModels.find((model) => model.key === request.key) ?? null;
    const llmChatTemplatePath = resolveChatTemplatePath(
      selectedCatalogModel,
      deps.resolveLlmAssetPath ?? resolveDefaultLlmAssetPath
    );
    const selected = await deps.selectionRepository.selectModel(request.key, llmServerPath, llmChatTemplatePath);
    if (!selected) {
      throw new AppException({
        code: 'LLM_MANAGER_SELECT_MODEL_NOT_DOWNLOADED',
        userMessage: 'The selected model is not downloaded and cannot be activated.'
      });
    }

    return selected as SelectModelResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.getSettings, async () => {
    await reconcileDownloadedModels();
    const settings = await healLegacyActiveModelSettings();
    return { settings } as GetSettingsResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.updateSettings, async (payload, ctx) => {
    const request = validateOrThrow(llmManagerSchemas.updateSettings, payload);
    const settings = await deps.settingsRepository.updateRuntimeSettings(request.settings);
    return { settings } as UpdateSettingsResponse;
  });

  safeHandle(ipcMain, LLM_MANAGER_CHANNELS.resetSettingsToDefaults, async () => {
    const llmServerPath = (deps.resolveLlmServerPath ?? resolveDefaultLlmServerPath)();
    const activeModel = await deps.selectionRepository.getActiveModel();
    const catalogModels = await deps.selectionRepository.listCatalogModels();
    const activeCatalogModel = activeModel
      ? catalogModels.find((model) => model.key === activeModel.key) ?? null
      : null;
    const llmChatTemplatePath = resolveChatTemplatePath(
      activeCatalogModel,
      deps.resolveLlmAssetPath ?? resolveDefaultLlmAssetPath
    );
    const reset = await deps.selectionRepository.resetSettingsToDefaults(llmServerPath, llmChatTemplatePath);
    if (!reset) {
      throw new AppException({
        code: 'LLM_MANAGER_RESET_NO_ACTIVE_MODEL',
        userMessage: 'No active model is selected to reset settings from defaults.'
      });
    }
    return reset as ResetSettingsToDefaultsResponse;
  });
}
