import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';
import type { FeedbackItem } from '@/features/feedback/domain';
import type { AddBlockFeedbackRequest } from '@/app/ports/assessment.port';

interface SessionApiMocks {
  listByFile: ReturnType<typeof vi.fn>;
  getTurns: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
  deleteSession: ReturnType<typeof vi.fn>;
  sendMessage: ReturnType<typeof vi.fn>;
  onStreamChunk: ReturnType<typeof vi.fn>;
}

interface AssessmentApiMocks {
  listFeedback: ReturnType<typeof vi.fn>;
  addFeedback: ReturnType<typeof vi.fn>;
}

function installWindowApiMocks(sessionApiMocks?: Partial<SessionApiMocks>, assessmentApiMocks?: Partial<AssessmentApiMocks>) {
  const listByFile =
    sessionApiMocks?.listByFile ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: []
      }
    });
  const getTurns =
    sessionApiMocks?.getTurns ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        fileEntityUuid: 'file-1',
        turns: []
      }
    });
  const create =
    sessionApiMocks?.create ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'simple-chat:file-1:1700000000000',
        fileEntityUuid: 'file-1'
      }
    });
  const deleteSession =
    sessionApiMocks?.deleteSession ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        deleted: true
      }
    });
  const sendMessage =
    sessionApiMocks?.sendMessage ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: { reply: 'stub-reply' }
    });
  const onStreamChunk =
    sessionApiMocks?.onStreamChunk ??
    vi.fn().mockImplementation(() => () => {});
  const listFeedback =
    assessmentApiMocks?.listFeedback ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        feedback: []
      }
    });
  const addFeedback =
    assessmentApiMocks?.addFeedback ??
    vi.fn().mockResolvedValue({
      ok: true,
      data: {
        feedback: {
          id: 'feedback-created-1',
          fileId: 'file-1',
          source: 'llm',
          kind: 'block',
          commentText: 'Created comment',
          createdAt: new Date('2026-02-24T00:00:00.000Z').toISOString()
        }
      }
    });

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
        extractDocument: async () => ({ ok: true, data: { fileId: 'file-1', text: 'stub', markdown: 'stub' } }),
        listFeedback,
        addFeedback,
        editFeedback: async () => ({ ok: true, data: { feedback: null } }),
        deleteFeedback: async () => ({ ok: true, data: { deleted: true } }),
        applyFeedback: async () => ({ ok: true, data: { feedback: null } }),
        sendFeedbackToLlm: async () => ({ ok: true, data: { feedback: null } }),
        generateFeedbackDocument: async () => ({ ok: true, data: { outputPath: '/tmp/out.docx' } }),
        requestLlmAssessment: async () => ({ ok: true, data: { createdFeedbackCount: 0, createdFeedbackIds: [] } })
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
        sendMessage,
        onStreamChunk
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
      },
      llmSession: {
        create,
        delete: deleteSession,
        clear: async () => ({ ok: true, data: { sessionId: 'unused', cleared: true } }),
        getTurns,
        listByFile
      }
    },
    configurable: true
  });

  return { listByFile, getTurns, create, deleteSession, sendMessage, onStreamChunk, listFeedback, addFeedback };
}

function renderApp() {
  const queryClient = createAppQueryClient();
  render(
    <AppProviders queryClient={queryClient}>
      <App />
    </AppProviders>
  );
}

async function selectFileFromWorkspace() {
  fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
  const fileButton = await screen.findByRole('button', { name: 'essay-a.docx' });
  fireEvent.click(fileButton);
}

describe('ChatView session orchestration', () => {
  it('loads chat sessions for selected file and preloads active session turns', async () => {
    const listByFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: [
          {
            sessionId: 'session-a',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-03T00:00:00.000Z'
          },
          {
            sessionId: 'session-b',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-02T00:00:00.000Z'
          }
        ]
      }
    });
    const getTurns = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        fileEntityUuid: 'file-1',
        turns: [{ role: 'assistant', content: 'Session A turn' }]
      }
    });
    installWindowApiMocks({ listByFile, getTurns });
    renderApp();

    await selectFileFromWorkspace();

    await waitFor(() => {
      expect(listByFile).toHaveBeenCalledWith({ fileEntityUuid: 'file-1' });
      expect(getTurns).toHaveBeenCalledWith({ sessionId: 'session-a', fileEntityUuid: 'file-1' });
    });
    expect(screen.getByRole('button', { name: 'Open Chat 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open Chat 2' })).toBeTruthy();
  });

  it('opens selected session in chat screen and loads its turns', async () => {
    const listByFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: [
          {
            sessionId: 'session-a',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-03T00:00:00.000Z'
          },
          {
            sessionId: 'session-b',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-02T00:00:00.000Z'
          }
        ]
      }
    });
    const getTurns = vi.fn().mockImplementation(async ({ sessionId }: { sessionId: string }) => {
      if (sessionId === 'session-b') {
        return {
          ok: true,
          data: {
            sessionId: 'session-b',
            fileEntityUuid: 'file-1',
            turns: [{ role: 'assistant', content: '# Session B turn' }]
          }
        };
      }
      return {
        ok: true,
        data: {
          sessionId: 'session-a',
          fileEntityUuid: 'file-1',
          turns: [{ role: 'assistant', content: 'Session A turn' }]
        }
      };
    });
    installWindowApiMocks({ listByFile, getTurns });
    renderApp();

    await selectFileFromWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Chat 2' }));

    await waitFor(() => {
      expect(getTurns).toHaveBeenCalledWith({ sessionId: 'session-b', fileEntityUuid: 'file-1' });
    });
    expect(await screen.findByTestId('chat-screen')).toBeTruthy();
    expect(screen.getByText('Assistant')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Session B turn' })).toBeTruthy();
  });

  it('creates an editable block comment from an assistant chat bubble', async () => {
    const assistantText = 'Use stronger evidence in this paragraph.\n\n- cite the data';
    const feedbackStore: FeedbackItem[] = [];
    const listByFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: [
          {
            sessionId: 'session-a',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-03T00:00:00.000Z'
          }
        ]
      }
    });
    const getTurns = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        fileEntityUuid: 'file-1',
        turns: [
          { role: 'teacher', content: 'Teacher prompt' },
          { role: 'assistant', content: assistantText },
          { role: 'system', content: 'System note' }
        ]
      }
    });
    const listFeedback = vi.fn().mockImplementation(async () => ({
      ok: true,
      data: {
        feedback: feedbackStore
      }
    }));
    const addFeedback = vi.fn().mockImplementation(async (request: Omit<AddBlockFeedbackRequest, 'fileId'>) => {
      const feedback: FeedbackItem = {
        id: 'feedback-from-chat-1',
        fileId: 'file-1',
        createdAt: new Date('2026-02-24T00:00:00.000Z').toISOString(),
        ...request
      };
      feedbackStore.push(feedback);
      return {
        ok: true,
        data: {
          feedback
        }
      };
    });
    installWindowApiMocks({ listByFile, getTurns }, { listFeedback, addFeedback });
    renderApp();

    await selectFileFromWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Chat 1' }));
    expect(await screen.findByTestId('chat-screen')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Add to comments' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Add to comments' }));

    await waitFor(() => {
      expect(addFeedback).toHaveBeenCalledWith({
        kind: 'block',
        source: 'llm',
        commentText: assistantText,
        fileId: 'file-1'
      });
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Select Block comment/i }).getAttribute('data-active')).toBe('true');
    });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });

  it('does not create a duplicate when assistant text exactly matches an existing comment', async () => {
    const assistantText = 'This exact comment already exists.';
    const existingComment: FeedbackItem = {
      id: 'feedback-existing-1',
      fileId: 'file-1',
      source: 'llm',
      kind: 'block',
      commentText: assistantText,
      createdAt: new Date('2026-02-24T00:00:00.000Z').toISOString()
    };
    const listByFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: [
          {
            sessionId: 'session-a',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-03T00:00:00.000Z'
          }
        ]
      }
    });
    const getTurns = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        fileEntityUuid: 'file-1',
        turns: [{ role: 'assistant', content: assistantText }]
      }
    });
    const listFeedback = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        feedback: [existingComment]
      }
    });
    const addFeedback = vi.fn();
    installWindowApiMocks({ listByFile, getTurns }, { listFeedback, addFeedback });
    renderApp();

    await selectFileFromWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Chat 1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add to comments' }));

    await waitFor(() => {
      expect(addFeedback).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /Select Block comment/i }).getAttribute('data-active')).toBe('true');
    });
  });

  it('creates a new chat session and refreshes session list', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const newSessionId = 'simple-chat:file-1:1700000000000';
    const refreshedSessionsPayload = {
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: [
          {
            sessionId: newSessionId,
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-04T00:00:00.000Z',
            updatedAt: '2026-02-04T00:00:00.000Z',
            lastUsedAt: '2026-02-04T00:00:00.000Z'
          },
          {
            sessionId: 'session-a',
            fileEntityUuid: 'file-1',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-03T00:00:00.000Z'
          }
        ]
      }
    };
    const listByFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          fileEntityUuid: 'file-1',
          sessions: [
            {
              sessionId: 'session-a',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-03T00:00:00.000Z'
            }
          ]
        }
      })
      .mockResolvedValue(refreshedSessionsPayload);
    const create = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: newSessionId,
        fileEntityUuid: 'file-1'
      }
    });
    const getTurns = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: newSessionId,
        fileEntityUuid: 'file-1',
        turns: []
      }
    });
    installWindowApiMocks({ listByFile, create, getTurns });
    renderApp();

    await selectFileFromWorkspace();
    fireEvent.click(screen.getByRole('button', { name: 'Start new chat' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({ sessionId: newSessionId, fileEntityUuid: 'file-1' });
      expect(listByFile.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(getTurns).toHaveBeenCalledWith({ sessionId: newSessionId, fileEntityUuid: 'file-1' });
    });
    expect(screen.getByText('No messages in this chat yet.')).toBeTruthy();

    nowSpy.mockRestore();
  });

  it('renders mapped listByFile error codes in chat list screen', async () => {
    const listByFile = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: 'LLM_SESSION_LIST_BY_FILE_INVALID_RESPONSE',
        message: 'Backend invalid shape'
      }
    });
    installWindowApiMocks({ listByFile });
    renderApp();

    await selectFileFromWorkspace();

    expect((await screen.findAllByText('Session service returned an invalid response.')).length).toBeGreaterThan(0);
  });

  it('deletes a chat session and refreshes sessions for the file', async () => {
    const listByFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          fileEntityUuid: 'file-1',
          sessions: [
            {
              sessionId: 'session-a',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-03T00:00:00.000Z'
            },
            {
              sessionId: 'session-b',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-02T00:00:00.000Z'
            }
          ]
        }
      })
      .mockResolvedValue({
        ok: true,
        data: {
          fileEntityUuid: 'file-1',
          sessions: [
            {
              sessionId: 'session-b',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-02T00:00:00.000Z'
            }
          ]
        }
      });
    const deleteSession = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'session-a',
        deleted: true
      }
    });

    installWindowApiMocks({ listByFile, deleteSession });
    renderApp();
    await selectFileFromWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Chat 1' }));

    await waitFor(() => {
      expect(deleteSession).toHaveBeenCalledWith({ sessionId: 'session-a' });
      expect(listByFile).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole('button', { name: 'Delete Chat 2' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Chat 1' })).toBeTruthy();
  });

  it('preserves active session and refreshes turns/list after chat send completes', async () => {
    const listByFile = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          fileEntityUuid: 'file-1',
          sessions: [
            {
              sessionId: 'session-a',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-03T00:00:00.000Z'
            },
            {
              sessionId: 'session-b',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-02T00:00:00.000Z'
            }
          ]
        }
      })
      .mockResolvedValue({
        ok: true,
        data: {
          fileEntityUuid: 'file-1',
          sessions: [
            {
              sessionId: 'session-a',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-05T00:00:00.000Z'
            },
            {
              sessionId: 'session-b',
              fileEntityUuid: 'file-1',
              createdAt: '2026-02-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
              lastUsedAt: '2026-02-04T00:00:00.000Z'
            }
          ]
        }
      });
    const getTurns = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          sessionId: 'session-a',
          fileEntityUuid: 'file-1',
          turns: [{ role: 'assistant', content: 'Session A turn' }]
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          sessionId: 'session-b',
          fileEntityUuid: 'file-1',
          turns: [{ role: 'assistant', content: 'Session B turn' }]
        }
      })
      .mockResolvedValue({
        ok: true,
        data: {
          sessionId: 'session-b',
          fileEntityUuid: 'file-1',
          turns: [{ role: 'assistant', content: 'Session B refreshed turn' }]
        }
      });
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        reply: 'Assistant reply'
      }
    });
    const sessionMocks = installWindowApiMocks({ listByFile, getTurns, sendMessage });

    renderApp();
    await selectFileFromWorkspace();
    fireEvent.click(await screen.findByRole('button', { name: 'Open Chat 2' }));
    await screen.findByTestId('chat-screen');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'hello session b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          fileId: 'file-1',
          sessionId: 'session-b',
          message: 'hello session b'
        })
      );
      expect(sessionMocks.listByFile.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(await screen.findByText('Session B refreshed turn')).toBeTruthy();
    expect(getTurns).toHaveBeenCalledWith({ sessionId: 'session-b', fileEntityUuid: 'file-1' });
  });

  it('keeps first-send optimistic and streamed messages visible before backend session appears', async () => {
    const listByFile = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: 'file-1',
        sessions: []
      }
    });
    const getTurns = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        sessionId: 'simple-chat:file-1',
        fileEntityUuid: 'file-1',
        turns: []
      }
    });
    let streamListener: ((event: unknown) => void) | undefined;
    const onStreamChunk = vi.fn().mockImplementation((listener: (event: unknown) => void) => {
      streamListener = listener;
      return () => {
        streamListener = undefined;
      };
    });
    let resolveSend: ((value: unknown) => void) | undefined;
    const sendMessage = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );

    installWindowApiMocks({ listByFile, getTurns, sendMessage, onStreamChunk });
    renderApp();

    await selectFileFromWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'First prompt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByTestId('chat-screen')).toBeTruthy();
    expect(screen.getByText('Teacher')).toBeTruthy();
    expect(screen.getByText('First prompt')).toBeTruthy();

    const payload = sendMessage.mock.calls[0]?.[0] as { clientRequestId?: string } | undefined;
    const clientRequestId = payload?.clientRequestId;
    expect(clientRequestId).toBeTypeOf('string');

    const currentStreamListener = streamListener;
    if (typeof currentStreamListener === 'function') {
      currentStreamListener({
        requestId: 'req-1',
        clientRequestId,
        type: 'chunk',
        seq: 1,
        channel: 'content',
        text: 'Partial stream'
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Partial stream')).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: 'Add to comments' })).toBeNull();

    const currentResolveSend = resolveSend;
    if (typeof currentResolveSend === 'function') {
      currentResolveSend({
        ok: true,
        data: {
          reply: 'Final stream reply'
        }
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Final stream reply')).toBeTruthy();
    });
  });
});
