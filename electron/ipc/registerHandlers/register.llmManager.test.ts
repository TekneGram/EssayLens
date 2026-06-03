import { describe, expect, it, vi } from 'vitest';
import { registerLlmManagerHandlers, LLM_MANAGER_CHANNELS } from './register.llmManager';
import type { IpcMainLike } from '../types';

function createIpcHarness() {
  const handlers = new Map<string, (event: unknown, payload?: unknown) => unknown | Promise<unknown>>();
  const ipc: IpcMainLike = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };
  return { ipc, handlers };
}

describe('registerLlmManagerHandlers', () => {
  it('resolves the configured Gemma chat template path during model selection', async () => {
    const { ipc, handlers } = createIpcHarness();
    const selectModel = vi.fn().mockResolvedValue({
      activeModel: {
        key: 'gemma4_e4b_it_q4_k_m',
        displayName: 'Gemma 4',
        localGgufPath: '/models/gemma.gguf',
        localMmprojPath: null,
        downloadedAt: '2026-01-01T00:00:00.000Z',
        isActive: true
      },
      settings: {}
    });

    registerLlmManagerHandlers(ipc, {
      selectionRepository: {
        listCatalogModels: vi.fn().mockResolvedValue([
          {
            key: 'gemma4_e4b_it_q4_k_m',
            displayName: 'Gemma 4',
            hfRepoId: 'repo',
            hfFilename: 'gemma.gguf',
            mmprojFilename: null,
            backend: 'server',
            modelFamily: 'gemma4',
            chatTemplateAsset: 'models/gemma_4_chat_template.jinja'
          }
        ]),
        listDownloadedModels: vi.fn().mockResolvedValue([]),
        getActiveModel: vi.fn().mockResolvedValue(null),
        selectModel,
        resetSettingsToDefaults: vi.fn(),
        upsertDownloadedModel: vi.fn(),
        getDownloadedModelByKey: vi.fn(),
        deleteDownloadedModel: vi.fn()
      } as any,
      settingsRepository: {
        getRuntimeSettings: vi.fn(),
        updateRuntimeSettings: vi.fn()
      } as any,
      downloadModel: vi.fn(),
      resolveLlmServerPath: vi.fn().mockReturnValue('/bin/llama-server'),
      resolveLlmAssetPath: vi.fn().mockImplementation((assetPath: string) => `/resources/assets/${assetPath}`)
    });

    const result = await handlers.get(LLM_MANAGER_CHANNELS.selectModel)?.(null, { key: 'gemma4_e4b_it_q4_k_m' });

    expect(selectModel).toHaveBeenCalledWith(
      'gemma4_e4b_it_q4_k_m',
      '/bin/llama-server',
      '/resources/assets/models/gemma_4_chat_template.jinja'
    );
    expect(result).toEqual(expect.objectContaining({ ok: true }));
  });

  it('keeps the current default behavior when a model has no chat template asset', async () => {
    const { ipc, handlers } = createIpcHarness();
    const selectModel = vi.fn().mockResolvedValue({
      activeModel: {
        key: 'qwen3_4b_q8',
        displayName: 'Qwen3 4B Q8_0',
        localGgufPath: '/models/qwen.gguf',
        localMmprojPath: null,
        downloadedAt: '2026-01-01T00:00:00.000Z',
        isActive: true
      },
      settings: {}
    });

    registerLlmManagerHandlers(ipc, {
      selectionRepository: {
        listCatalogModels: vi.fn().mockResolvedValue([
          {
            key: 'qwen3_4b_q8',
            displayName: 'Qwen3 4B Q8_0',
            hfRepoId: 'repo',
            hfFilename: 'qwen.gguf',
            mmprojFilename: null,
            backend: 'server',
            modelFamily: 'instruct/think',
            chatTemplateAsset: null
          }
        ]),
        listDownloadedModels: vi.fn().mockResolvedValue([]),
        getActiveModel: vi.fn().mockResolvedValue(null),
        selectModel,
        resetSettingsToDefaults: vi.fn(),
        upsertDownloadedModel: vi.fn(),
        getDownloadedModelByKey: vi.fn(),
        deleteDownloadedModel: vi.fn()
      } as any,
      settingsRepository: {
        getRuntimeSettings: vi.fn(),
        updateRuntimeSettings: vi.fn()
      } as any,
      downloadModel: vi.fn(),
      resolveLlmServerPath: vi.fn().mockReturnValue('/bin/llama-server'),
      resolveLlmAssetPath: vi.fn()
    });

    await handlers.get(LLM_MANAGER_CHANNELS.selectModel)?.(null, { key: 'qwen3_4b_q8' });

    expect(selectModel).toHaveBeenCalledWith('qwen3_4b_q8', '/bin/llama-server', null);
  });
});
