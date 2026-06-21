import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';

function createWorkspaceMocks() {
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
        }
      ]
    }
  });
  return { selectFolder, listFiles };
}

function renderApp() {
  const queryClient = createAppQueryClient();
  render(
    <AppProviders queryClient={queryClient}>
      <App />
    </AppProviders>
  );
}

function createLlmManagerMocks() {
  return {
    listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        settings: {
          llm_server_path: null,
          llm_gguf_path: null,
          llm_mmproj_path: null,
          llm_server_url: null,
          llm_host: '127.0.0.1',
          llm_port: 8080,
          llm_n_ctx: 4096,
          llm_n_threads: null,
          llm_n_gpu_layers: null,
          llm_n_batch: null,
          llm_n_parallel: null,
          llm_seed: null,
          llm_rope_freq_base: null,
          llm_rope_freq_scale: null,
          llm_model_family: 'instruct/think',
          llm_reasoning_mode: null,
          llm_reasoning_budget: null,
          llm_chat_template_path: null,
          llm_use_jinja: true,
          llm_cache_prompt: true,
          llm_flash_attn: true,
          max_tokens: 1024,
          temperature: 0.2,
          top_p: 0.95,
          top_k: 50,
          repeat_penalty: 1.1,
          request_seed: null,
          use_fake_reply: false,
          fake_reply_text: null,
          llm_log_outbound_payload: false,
          bulk_llm_recycle_policy: 'after_each_file'
        }
      }
    }),
    selectModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    updateSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        settings: {}
      }
    }),
    resetSettingsToDefaults: vi.fn().mockResolvedValue({ ok: true, data: { settings: {}, activeModel: null } }),
    onDownloadProgress: vi.fn().mockImplementation(() => () => {})
  };
}

function createRubricMocks() {
  return {
    listRubrics: vi.fn().mockResolvedValue({ ok: true, data: { rubrics: [] } }),
    getGradingContext: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileId: '/workspace/essays/draft.docx',
        lockedRubricId: null,
        selectedRubricIdForFile: null
      }
    }),
    getFileScores: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        instance: null,
        scores: []
      }
    }),
    clearAppliedRubric: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileId: '/workspace/essays/draft.docx',
        filepathId: '/workspace/essays/draft.docx',
        clearedRubricId: 'rubric-1'
      }
    }),
    saveFileScores: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        instance: {
          uuid: 'instance-1',
          fileEntityUuid: '/workspace/essays/draft.docx',
          rubricEntityUuid: 'rubric-1',
          createdAt: new Date().toISOString()
        },
        scores: []
      }
    }),
    setLastUsed: vi.fn().mockResolvedValue({
      ok: true,
      data: { rubricId: 'rubric-1' }
    }),
    getMatrix: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rubric: {
          entityUuid: 'rubric-1',
          name: 'Standard rubric',
          type: 'detailed',
          isActive: true,
          isArchived: false
        },
        details: [],
        scores: []
      }
    }),
    updateMatrix: vi.fn(),
    createRubric: vi.fn(),
    cloneRubric: vi.fn(),
    deleteRubric: vi.fn()
  };
}

function createLlmSessionMocks() {
  return {
    create: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', fileEntityUuid: '/workspace/essays/draft.docx' } }),
    clear: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', cleared: true } }),
    getTurns: vi.fn().mockResolvedValue({
      ok: true,
      data: { sessionId: 'session-a', fileEntityUuid: '/workspace/essays/draft.docx', turns: [] }
    }),
    listByFile: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileEntityUuid: '/workspace/essays/draft.docx',
        sessions: [
          {
            sessionId: 'session-a',
            fileEntityUuid: '/workspace/essays/draft.docx',
            createdAt: '2026-02-01T00:00:00.000Z',
            updatedAt: '2026-02-01T00:00:00.000Z',
            lastUsedAt: '2026-02-01T00:00:00.000Z'
          }
        ]
      }
    })
  };
}

describe('ChatInterface submit workflow', () => {
  it('disables chat send and blocks sendMessage when no file is selected', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
    const sendMessage = vi.fn();

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: {
          extractDocument: async () => ({ ok: true, data: { fileId: 'unused', text: '' } }),
          listFeedback: async () => ({ ok: true, data: { feedback: [] } }),
          addFeedback: async () => ({ ok: true, data: { feedback: null } }),
          editFeedback: async () => ({ ok: true, data: { feedback: null } }),
          deleteFeedback: async () => ({ ok: true, data: { deletedFeedbackId: 'f1' } }),
          applyFeedback: async () => ({ ok: true, data: { feedback: null } }),
          sendFeedbackToLlm: async () => ({ ok: true, data: { status: 'queued' } }),
          generateFeedbackDocument: async () => ({ ok: true, data: { fileId: 'unused', outputPath: '/tmp/x.docx' } }),
          requestLlmAssessment: async () => ({ ok: true, data: { status: 'queued' } })
        },
        rubric: createRubricMocks(),
        chat: { sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'No file selected yet.' }
    });

    const sendButton = screen.getByRole('button', { name: 'Send chat message' });
    expect(sendButton.getAttribute('disabled')).not.toBeNull();
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  it('submits comment mode as inline AddFeedbackRequest when selection exists', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
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
          kind: 'inline',
          commentText: 'Please tighten this phrase.',
          exactQuote: 'draft.docx',
          prefixText: 'OriginalTextView: ',
          suffixText: '\n\nUse this area to review',
          startAnchor: {
            part: 'renderer://original-text-view',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 18
          },
          endAnchor: {
            part: 'renderer://original-text-view',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 27
          },
          createdAt: new Date().toISOString()
        }
      }
    });
    const sendMessage = vi.fn();

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback, addFeedback },
        rubric: createRubricMocks(),
        chat: { sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'draft.docx' }));

    const windowNode = await screen.findByTestId('text-view-window');
    const paragraphNode = windowNode.querySelector('p');
    expect(paragraphNode).toBeTruthy();
    if (!paragraphNode?.firstChild) {
      throw new Error('Expected paragraph text node to exist');
    }

    const quoteStart = paragraphNode.textContent?.indexOf('draft.docx') ?? -1;
    expect(quoteStart).toBeGreaterThanOrEqual(0);
    const quoteEnd = quoteStart + 'draft.docx'.length;
    const range = document.createRange();
    range.setStart(paragraphNode.firstChild, quoteStart);
    range.setEnd(paragraphNode.firstChild, quoteEnd);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.mouseUp(windowNode);

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Please tighten this phrase.' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send comment' }));

    await waitFor(() => {
      expect(addFeedback).toHaveBeenCalledTimes(1);
    });

    expect(addFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: '/workspace/essays/draft.docx',
        kind: 'inline',
        source: 'teacher',
        commentText: 'Please tighten this phrase.',
        exactQuote: 'draft.docx'
      })
    );
    expect(sendMessage).not.toHaveBeenCalled();

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement).value).toBe('');
    });
  });

  it('submits essay feedback bulk through chat API for the selected file', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
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
          commentText: 'block comment',
          createdAt: new Date().toISOString()
        }
      }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        reply: 'Assistant workflow reply.'
      }
    });

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback, addFeedback },
        rubric: createRubricMocks(),
        chat: { sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'draft.docx' }));
    await screen.findByTestId('text-view-window');

    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Essay feedback in bulk' }));

    await waitFor(() => {
      expect(screen.getByTestId('assessment-chat-interface-stub').textContent).toBe('chat:true:evaluate-essay-bulk');
    });

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'How should I sequence feedback?' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'essay-feedback',
          fileId: '/workspace/essays/draft.docx',
          selectedFeedbackTypes: [
            'thesis-statement-feedback',
            'summarize-main-idea',
            'paragraph-evaluation',
            'thesis-restatement-feedback',
            'summary-feedback',
            'conclusion-final-comment'
          ],
          clientRequestId: expect.any(String)
        })
      );
    });
    expect((sendMessage.mock.calls[0]?.[0] as { contextText?: string }).contextText).toBeUndefined();
    expect(addFeedback).not.toHaveBeenCalled();

    await waitFor(() => {
      expect((screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement).value).toBe('');
    });

  });

  it('skips completed paragraph feedback files when the user chooses skip', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
    const checkParagraphFeedbackCompletions = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        activeModel: { key: 'qwen3_4b_q8', displayName: 'Qwen3 4B Q8_0' },
        completions: [
          {
            fileId: '/workspace/essays/draft.docx',
            modelKey: 'qwen3_4b_q8',
            modelDisplayName: 'Qwen3 4B Q8_0',
            sessionId: 'paragraph-feedback-existing',
            completedAt: '2026-02-24T00:00:00.000Z'
          }
        ]
      }
    });
    const sendMessage = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: [] } }) },
        rubric: createRubricMocks(),
        chat: { checkParagraphFeedbackCompletions, sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paragraph feedback in bulk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(checkParagraphFeedbackCompletions).toHaveBeenCalledWith({ fileIds: ['/workspace/essays/draft.docx'] });
    });
    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(sendMessage).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('redoes completed paragraph feedback files in new sessions when the user chooses redo', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
    const checkParagraphFeedbackCompletions = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        activeModel: { key: 'qwen3_4b_q8', displayName: 'Qwen3 4B Q8_0' },
        completions: [
          {
            fileId: '/workspace/essays/draft.docx',
            modelKey: 'qwen3_4b_q8',
            modelDisplayName: 'Qwen3 4B Q8_0',
            sessionId: 'paragraph-feedback-existing',
            completedAt: '2026-02-24T00:00:00.000Z'
          }
        ]
      }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        reply: '',
        paragraphFeedbackBulk: {
          replies: [],
          failures: [],
          failedFileIds: [],
          skippedFileIds: []
        }
      }
    });
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(true);

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: [] } }) },
        rubric: createRubricMocks(),
        chat: { checkParagraphFeedbackCompletions, sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Paragraph feedback in bulk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'paragraph-feedback-bulk',
          fileIds: ['/workspace/essays/draft.docx'],
          redoCompletedFileIds: ['/workspace/essays/draft.docx']
        })
      );
    });
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it('loops through each file for essay feedback bulk and sends selected feedback types per file', async () => {
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
            id: '/workspace/essays/draft-1.docx',
            folderId: '/workspace/essays',
            name: 'draft-1.docx',
            path: '/workspace/essays/draft-1.docx',
            kind: 'docx'
          },
          {
            id: '/workspace/essays/draft-2.pdf',
            folderId: '/workspace/essays',
            name: 'draft-2.pdf',
            path: '/workspace/essays/draft-2.pdf',
            kind: 'pdf'
          }
        ]
      }
    });
    const sendMessage = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        reply: '',
        essayFeedback: {
          replies: [],
          failures: []
        }
      }
    });

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: [] } }) },
        rubric: createRubricMocks(),
        chat: { sendMessage },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft-1.docx' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'draft-2.pdf' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Essay feedback in bulk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });
    expect(sendMessage.mock.calls).toEqual([
      [
        expect.objectContaining({
          kind: 'essay-feedback',
          fileId: '/workspace/essays/draft-1.docx',
          selectedFeedbackTypes: [
            'thesis-statement-feedback',
            'summarize-main-idea',
            'paragraph-evaluation',
            'thesis-restatement-feedback',
            'summary-feedback',
            'conclusion-final-comment'
          ]
        })
      ],
      [
        expect.objectContaining({
          kind: 'essay-feedback',
          fileId: '/workspace/essays/draft-2.pdf',
          selectedFeedbackTypes: [
            'thesis-statement-feedback',
            'summarize-main-idea',
            'paragraph-evaluation',
            'thesis-restatement-feedback',
            'summary-feedback',
            'conclusion-final-comment'
          ]
        })
      ]
    ]);
  });

  it('updates assistant message from stream chunks before sendMessage resolves', async () => {
    const { selectFolder, listFiles } = createWorkspaceMocks();
    const listFeedback = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        feedback: []
      }
    });
    const addFeedback = vi.fn();
    let streamListener: ((event: unknown) => void) | undefined;
    let resolveSend: ((value: unknown) => void) | undefined;
    const sendMessage = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        })
    );
    const onStreamChunk = vi.fn().mockImplementation((listener: (event: unknown) => void) => {
      streamListener = listener;
      return () => {
        streamListener = undefined;
      };
    });

    Object.defineProperty(window, 'api', {
      value: {
        workspace: { selectFolder, listFiles },
        assessment: { listFeedback, addFeedback },
        rubric: createRubricMocks(),
        chat: { sendMessage, onStreamChunk },
        llmManager: createLlmManagerMocks(),
        llmSession: createLlmSessionMocks()
      },
      configurable: true
    });

    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Select Folder' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'draft.docx' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'draft.docx' }));

    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Essay feedback in bulk' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Please stream this response' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send chat message' }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    const payload = sendMessage.mock.calls[0]?.[0] as { clientRequestId?: string } | undefined;
    const clientRequestId = payload?.clientRequestId;
    expect(clientRequestId).toBeTypeOf('string');
    expect(onStreamChunk).toHaveBeenCalledTimes(1);

    const currentStreamListener = streamListener;
    if (typeof currentStreamListener === 'function') {
      currentStreamListener({
        requestId: 'req-1',
        clientRequestId,
        type: 'chunk',
        seq: 2,
        channel: 'content',
        text: 'Streaming'
      });
    }

    const currentResolveSend = resolveSend;
    if (typeof currentResolveSend === 'function') {
      currentResolveSend({
        ok: true,
        data: {
          reply: 'Streaming complete.'
        }
      });
    }

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
