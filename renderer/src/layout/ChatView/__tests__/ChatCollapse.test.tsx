import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';

function installWindowApiMocks() {
  Object.defineProperty(window, 'api', {
    value: {
      workspace: {
        selectFolder: async () =>
          ({
            ok: true,
            data: {
              folder: {
                id: 'folder-1',
                path: '/tmp/folder-1',
                name: 'folder-1'
              }
            }
          }),
        listFiles: async () =>
          ({
            ok: true,
            data: {
              files: [
                {
                  id: 'file-1',
                  folderId: 'folder-1',
                  name: 'essay-a.docx',
                  path: '/tmp/folder-1/essay-a.docx',
                  kind: 'docx'
                }
              ]
            }
          }),
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
                llm_flash_attn: true,
                bulk_llm_recycle_policy: 'after_each_file'
              }
            }
          }),
        selectModel: async () => ({ ok: true, data: { model: null } }),
        updateSettings: async () => ({ ok: true, data: { settings: {} } }),
        resetSettingsToDefaults: async () => ({ ok: true, data: { settings: {}, activeModel: null } }),
        onDownloadProgress: () => () => {}
      },
      llmSession: {
        create: async () => ({ ok: true, data: { sessionId: 'session-a', fileEntityUuid: 'file-1' } }),
        clear: async () => ({ ok: true, data: { sessionId: 'session-a', cleared: true } }),
        delete: async () => ({ ok: true, data: { sessionId: 'session-a', deleted: true } }),
        getTurns: async () => ({ ok: true, data: { sessionId: 'session-a', fileEntityUuid: 'file-1', turns: [] } }),
        listByFile: async () =>
          ({
            ok: true,
            data: {
              fileEntityUuid: 'file-1',
              sessions: [
                {
                  sessionId: 'session-a',
                  fileEntityUuid: 'file-1',
                  createdAt: '2026-02-01T00:00:00.000Z',
                  updatedAt: '2026-02-01T00:00:00.000Z',
                  lastUsedAt: '2026-02-02T00:00:00.000Z'
                }
              ]
            }
          })
      }
    },
    configurable: true
  });
}

function renderApp() {
  installWindowApiMocks();
  const queryClient = createAppQueryClient();
  render(
    <AppProviders queryClient={queryClient}>
      <App />
    </AppProviders>
  );
}

async function selectFile() {
  fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'essay-a.docx' })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: 'essay-a.docx' }));
}

describe('Chat collapse behavior', () => {
  it('collapses chat view into a thin rail and can expand it again', () => {
    renderApp();

    const shell = screen.getByTestId('app-shell');
    expect(shell.getAttribute('data-chat-collapsed')).toBe('false');
    expect(screen.getByTestId('chat-view')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat panel' }));

    expect(shell.getAttribute('data-chat-collapsed')).toBe('true');
    expect(screen.queryByTestId('chat-view')).toBeNull();
    expect(screen.getByTestId('chat-collapsed-rail')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Expand chat panel' }));

    expect(shell.getAttribute('data-chat-collapsed')).toBe('false');
    expect(screen.getByTestId('chat-view')).toBeTruthy();
  });

  it('keeps chat view collapsed while typing and sending comment mode input', () => {
    renderApp();

    const shell = screen.getByTestId('app-shell');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat panel' }));
    expect(screen.queryByTestId('chat-view')).toBeNull();
    expect(shell.getAttribute('data-chat-collapsed')).toBe('true');

    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.focus(input);
    fireEvent.click(input);
    fireEvent.change(input, { target: { value: 'Keep this as comment mode.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));

    expect(shell.getAttribute('data-chat-collapsed')).toBe('true');
    expect(screen.queryByTestId('chat-view')).toBeNull();
  });

  it('expands chat view only when chat mode message is sent', async () => {
    renderApp();
    await selectFile();

    const shell = screen.getByTestId('app-shell');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat panel' }));
    expect(shell.getAttribute('data-chat-collapsed')).toBe('true');
    expect(screen.queryByTestId('chat-view')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'Open panel from chat send.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    expect(shell.getAttribute('data-chat-collapsed')).toBe('false');
    expect(screen.getByTestId('chat-view')).toBeTruthy();
  });

  it('expands chat view when enter submits in chat mode', async () => {
    renderApp();
    await selectFile();

    const shell = screen.getByTestId('app-shell');
    fireEvent.click(screen.getByRole('button', { name: 'Collapse chat panel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));
    const input = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(input, { target: { value: 'Open panel from enter.' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(shell.getAttribute('data-chat-collapsed')).toBe('false');
    expect(screen.getByTestId('chat-view')).toBeTruthy();
  });
});
