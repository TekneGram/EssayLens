import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';
import { LlmManager } from '../LlmManager';

describe('LlmDownload progress', () => {
  it('renders download progress updates from llmManager progress events', async () => {
    const listeners: Array<(event: {
      key: 'qwen3_4b_q8';
      phase: 'downloading';
      bytesReceived: number;
      bytesTotal: number;
      percent: number;
      status: string;
      errorMessage: null;
    }) => void> = [];

    Object.defineProperty(window, 'api', {
      value: {
        workspace: {},
        assessment: {},
        rubric: {},
        chat: {},
        llmManager: {
          listCatalogModels: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              models: [
                {
                  key: 'qwen3_4b_q8',
                  displayName: 'Qwen3 4B Q8_0',
                  hfRepoId: 'Qwen/Qwen3-4B-GGUF',
                  hfFilename: 'Qwen3-4B-Q8_0.gguf',
                  mmprojFilename: null,
                  backend: 'server',
                  modelFamily: 'instruct/think',
                  chatTemplateAsset: null
                }
              ]
            }
          }),
          listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
          getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
          downloadModel: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              model: {
                key: 'qwen3_4b_q8',
                displayName: 'Qwen3 4B Q8_0',
                localGgufPath: '/models/Qwen3-4B-Q8_0.gguf',
                localMmprojPath: null,
                downloadedAt: '2026-02-22T10:00:00.000Z',
                isActive: false
              }
            }
          }),
          onDownloadProgress: (listener: (event: never) => void) => {
            listeners.push(listener as unknown as (event: {
              key: 'qwen3_4b_q8';
              phase: 'downloading';
              bytesReceived: number;
              bytesTotal: number;
              percent: number;
              status: string;
              errorMessage: null;
            }) => void);
            return () => {};
          },
          selectModel: vi.fn(),
          getSettings: vi.fn().mockResolvedValue({ ok: true, data: { settings: {} } }),
          updateSettings: vi.fn(),
          resetSettingsToDefaults: vi.fn()
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

    await waitFor(() => {
      expect(screen.getByLabelText('Download Qwen3 4B Q8_0')).toBeTruthy();
      expect(screen.getByText('Template: Default server/model template')).toBeTruthy();
    });

    listeners[0]?.({
      key: 'qwen3_4b_q8',
      phase: 'downloading',
      bytesReceived: 50,
      bytesTotal: 100,
      percent: 50,
      status: 'Downloading model',
      errorMessage: null
    });

    await waitFor(() => {
      expect(screen.getByText('Downloading model')).toBeTruthy();
      expect(screen.getByText('50%')).toBeTruthy();
      expect(screen.getByRole('progressbar', { name: 'Downloading Qwen3 4B Q8_0' })).toBeTruthy();
    });
  });

  it('renders the configured Jinja filename for models with an app-supplied template', async () => {
    Object.defineProperty(window, 'api', {
      value: {
        workspace: {},
        assessment: {},
        rubric: {},
        chat: {},
        llmManager: {
          listCatalogModels: vi.fn().mockResolvedValue({
            ok: true,
            data: {
              models: [
                {
                  key: 'gemma4_e4b_it_q4_k_m',
                  displayName: 'Gemma 4 E4B Instruct Q4_K_M',
                  hfRepoId: 'ggml-org/gemma-4-E4B-it-GGUF',
                  hfFilename: 'gemma-4-E4B-it-Q4_K_M.gguf',
                  mmprojFilename: null,
                  backend: 'server',
                  modelFamily: 'gemma4',
                  chatTemplateAsset: 'models/gemma_4_chat_template.jinja'
                }
              ]
            }
          }),
          listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
          getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
          downloadModel: vi.fn(),
          onDownloadProgress: () => () => {},
          selectModel: vi.fn(),
          getSettings: vi.fn().mockResolvedValue({ ok: true, data: { settings: {} } }),
          updateSettings: vi.fn(),
          resetSettingsToDefaults: vi.fn()
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

    await waitFor(() => {
      expect(screen.getByText('Template: gemma_4_chat_template.jinja')).toBeTruthy();
    });
  });
});
