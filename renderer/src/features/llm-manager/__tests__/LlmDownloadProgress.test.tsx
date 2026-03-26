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
                  modelFamily: 'instruct/think'
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
});
