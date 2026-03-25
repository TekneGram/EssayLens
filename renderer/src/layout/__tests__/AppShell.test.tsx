import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';

function installWindowApiMocks() {
  Object.defineProperty(window, 'api', {
    value: {
      workspace: {
        selectFolder: async () => ({ ok: true, data: { folder: null } }),
        listFiles: async () => ({ ok: true, data: { files: [] } }),
        getCurrentFolder: async () => ({ ok: true, data: { folder: null } })
      },
      assessment: {
        listFeedback: async () => ({ ok: true, data: { feedback: [] } }),
        addFeedback: async () => ({ ok: true, data: { feedback: null } })
      },
      rubric: {
        listRubrics: async () => ({ ok: true, data: { rubrics: [] } }),
        getGradingContext: async () =>
          ({ ok: true, data: { selectedRubricId: null, selectedMatrix: null, availableRubrics: [] } }),
        getFileScores: async () => ({ ok: true, data: { rubricId: null, selections: [] } }),
        clearAppliedRubric: async () => ({ ok: true, data: { cleared: true } }),
        saveFileScores: async () => ({ ok: true, data: { rubricId: null, selections: [], updatedAt: new Date().toISOString() } }),
        setLastUsed: async () => ({ ok: true, data: { rubricId: null, updatedAt: new Date().toISOString() } }),
        getMatrix: async () => ({ ok: true, data: { matrix: null } }),
        updateMatrix: async () => ({ ok: true, data: { matrix: null } }),
        createRubric: async () => ({ ok: true, data: { rubric: null } }),
        cloneRubric: async () => ({ ok: true, data: { rubric: null } }),
        deleteRubric: async () => ({ ok: true, data: { deleted: true } })
      },
      chat: {
        sendMessage: async () => ({ ok: true, data: { reply: 'stub-reply' } })
      },
      llmManager: {
        listCatalogModels: async () => ({ ok: true, data: { models: [] } }),
        listDownloadedModels: async () => ({ ok: true, data: { models: [] } }),
        getActiveModel: async () => ({ ok: true, data: { model: null } }),
        getSettings: async () =>
          ({
            ok: true,
            data: {
              settings: {
                llm_host: '127.0.0.1',
                llm_port: 8080,
                llm_n_ctx: 4096,
                max_tokens: 1024,
                temperature: 0.2,
                top_p: 0.95,
                top_k: 50,
                repeat_penalty: 1.1,
                llm_use_jinja: true,
                llm_cache_prompt: true,
                llm_flash_attn: true
              }
            }
          }),
        selectModel: async () => ({ ok: true, data: { model: null } }),
        updateSettings: async () => ({ ok: true, data: { settings: {} } }),
        resetSettingsToDefaults: async () => ({ ok: true, data: { settings: {}, activeModel: null } }),
        onDownloadProgress: () => () => {}
      }
    },
    configurable: true
  });
}

describe('App shell regions', () => {
  it('renders all top-level shell regions', () => {
    installWindowApiMocks();
    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    expect(screen.getByTestId('loader-bar')).toBeTruthy();
    expect(screen.getByTestId('file-display-bar')).toBeTruthy();
    expect(screen.getByTestId('assessment-window')).toBeTruthy();
    expect(screen.getByTestId('chat-view')).toBeTruthy();
    expect(screen.getByTestId('chat-interface')).toBeTruthy();
  });
});
