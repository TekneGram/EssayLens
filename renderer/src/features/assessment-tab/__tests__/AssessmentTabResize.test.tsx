import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../../App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';

function createLlmManagerApiMock() {
  return {
    listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    selectModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    updateSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    resetSettingsToDefaults: vi.fn().mockResolvedValue({
      ok: true,
      data: { settings: { llm_n_ctx: 4096, llm_n_predict: 1024, llm_top_k: 40, llm_top_p: 0.95, temperature: 0.2 } }
    }),
    onDownloadProgress: vi.fn().mockReturnValue(() => {})
  };
}

function setupApi() {
  const selectFolder = vi.fn().mockResolvedValue({
    ok: true,
    data: {
      folder: {
        id: '/workspace/essays',
        path: '/workspace/essays',
        name: 'essays'
      }
    }
  });
  const listFiles = vi.fn().mockResolvedValue({
    ok: true,
    data: {
      files: [
        {
          id: '/workspace/essays/draft.docx',
          folderId: '/workspace/essays',
          name: 'draft.docx',
          path: '/workspace/essays/draft.docx',
          kind: 'docx'
        },
        {
          id: '/workspace/essays/image.png',
          folderId: '/workspace/essays',
          name: 'image.png',
          path: '/workspace/essays/image.png',
          kind: 'png'
        }
      ]
    }
  });

  const listFeedback = vi.fn().mockResolvedValue({
    ok: true,
    data: {
      feedback: []
    }
  });
  const addFeedback = vi.fn().mockResolvedValue({
    ok: true,
    data: {
      feedback: {
        id: 'feedback-1',
        fileId: '/workspace/essays/draft.docx',
        source: 'teacher',
        kind: 'block',
        commentText: 'Looks good.',
        createdAt: new Date().toISOString()
      }
    }
  });

  Object.defineProperty(window, 'api', {
    value: {
      workspace: { selectFolder, listFiles },
      assessment: { listFeedback, addFeedback },
      llmManager: createLlmManagerApiMock(),
      rubric: {},
      chat: {}
    },
    configurable: true
  });
}

describe('Assessment tab pane resizing', () => {
  it('shows splitter in two-pane mode and updates ratio with keyboard arrows', async () => {
    setupApi();
    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'draft.docx' }));

    await waitFor(() => {
      expect(screen.getByTestId('assessment-tab').getAttribute('data-mode')).toBe('two-pane');
    });

    const splitter = screen.getByTestId('assessment-splitter');
    const tab = screen.getByTestId('assessment-tab');

    expect(tab.style.getPropertyValue('--assessment-left-ratio')).toBe('0.66');

    fireEvent.keyDown(splitter, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(tab.style.getPropertyValue('--assessment-left-ratio')).toBe('0.64');
    });

    fireEvent.keyDown(splitter, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(tab.style.getPropertyValue('--assessment-left-ratio')).toBe('0.66');
    });
  });

  it('hides splitter in three-pane image mode', async () => {
    setupApi();
    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'image.png' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'image.png' }));

    await waitFor(() => {
      expect(screen.getByTestId('assessment-tab').getAttribute('data-mode')).toBe('three-pane');
    });
    expect(screen.queryByTestId('assessment-splitter')).toBeNull();
  });
});
