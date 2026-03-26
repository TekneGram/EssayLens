import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '@/app/ports/llmManager.port';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';
import { LlmManager } from '../LlmManager';

function makeSettings(overrides: Partial<LlmRuntimeSettings> = {}): LlmRuntimeSettings {
  return {
    llm_server_path: '/usr/local/bin/llama-server',
    llm_gguf_path: '/models/Qwen3-4B-Q8_0.gguf',
    llm_mmproj_path: null,
    llm_server_url: 'http://127.0.0.1:8080',
    llm_host: '127.0.0.1',
    llm_port: 8080,
    llm_n_ctx: 4096,
    llm_n_threads: 6,
    llm_n_gpu_layers: 0,
    llm_n_batch: 512,
    llm_n_parallel: 1,
    llm_seed: null,
    llm_rope_freq_base: null,
    llm_rope_freq_scale: null,
    llm_use_jinja: true,
    llm_cache_prompt: true,
    llm_flash_attn: false,
    max_tokens: 512,
    temperature: 0.2,
    top_p: 0.9,
    top_k: 40,
    repeat_penalty: 1.05,
    request_seed: null,
    use_fake_reply: false,
    fake_reply_text: null,
    ...overrides
  };
}

describe('LlmConfiguration flows', () => {
  it('updates and resets runtime settings through llmManager API', async () => {
    const currentSettings = makeSettings({ temperature: 0.2 });
    const resetSettings = makeSettings({ temperature: 0.15 });

    const updateSettingsApi = vi.fn().mockImplementation(async (request: { settings: Partial<LlmRuntimeSettings> }) => ({
      ok: true,
      data: {
        settings: {
          ...currentSettings,
          ...request.settings
        }
      }
    }));

    const resetSettingsApi = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        activeModel: {
          key: 'qwen3_4b_q8',
          displayName: 'Qwen3 4B Q8_0',
          localGgufPath: '/models/Qwen3-4B-Q8_0.gguf',
          localMmprojPath: null,
          downloadedAt: '2026-02-22T10:00:00.000Z',
          isActive: true
        },
        settings: resetSettings
      }
    });

    Object.defineProperty(window, 'api', {
      value: {
        workspace: {},
        assessment: {},
        rubric: {},
        chat: {},
        llmManager: {
          listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
          listDownloadedModels: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              models: [
                {
                  key: 'qwen3_4b_q8',
                  displayName: 'Qwen3 4B Q8_0',
                  localGgufPath: '/models/Qwen3-4B-Q8_0.gguf',
                  localMmprojPath: null,
                  downloadedAt: '2026-02-22T10:00:00.000Z',
                  isActive: true
                }
              ]
            }
          }),
          getActiveModel: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              model: {
                key: 'qwen3_4b_q8',
                displayName: 'Qwen3 4B Q8_0',
                localGgufPath: '/models/Qwen3-4B-Q8_0.gguf',
                localMmprojPath: null,
                downloadedAt: '2026-02-22T10:00:00.000Z',
                isActive: true
              }
            }
          }),
          selectModel: vi.fn(),
          getSettings: vi.fn().mockResolvedValue({ ok: true, data: { settings: currentSettings } }),
          updateSettings: updateSettingsApi,
          resetSettingsToDefaults: resetSettingsApi
        }
      },
      configurable: true
    });

    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <LlmManager />
      </AppProviders>
    );

    const editTemperatureButton = await screen.findByRole('button', { name: 'Edit setting temperature' });
    expect(editTemperatureButton.textContent).toBe('0.2');
    expect(screen.getByRole('button', { name: 'Edit setting use_fake_reply' }).textContent).toBe('false');
    expect(screen.queryByRole('button', { name: 'Edit setting llm_host' })).toBeNull();
    expect(screen.getByText('127.0.0.1')).toBeTruthy();

    fireEvent.click(editTemperatureButton);
    fireEvent.change(screen.getByRole('textbox', { name: 'Value for temperature' }), {
      target: { value: '0.45' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateSettingsApi).toHaveBeenCalledWith({ settings: { temperature: 0.45 } });
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit setting temperature' }).textContent).toBe('0.45');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reset defaults' }));

    await waitFor(() => {
      expect(resetSettingsApi).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Edit setting temperature' }).textContent).toBe('0.15');
    });
  });
});
