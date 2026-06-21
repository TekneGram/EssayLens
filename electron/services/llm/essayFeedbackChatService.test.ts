import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { EssayFeedbackChatService } from './essayFeedbackChatService';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildRuntimeSettings(overrides: Partial<LlmRuntimeSettings> = {}): LlmRuntimeSettings {
  return {
    llm_server_path: '/tmp/llama-server',
    llm_gguf_path: '/tmp/model.gguf',
    llm_mmproj_path: null,
    llm_server_url: 'http://127.0.0.1:8080/v1/chat/completions',
    llm_host: '127.0.0.1',
    llm_port: 8080,
    llm_n_ctx: 4096,
    llm_n_threads: 4,
    llm_n_gpu_layers: 0,
    llm_n_batch: 128,
    llm_n_parallel: 1,
    llm_seed: 42,
    llm_rope_freq_base: null,
    llm_rope_freq_scale: null,
    llm_model_family: 'instruct/think',
    llm_reasoning_mode: null,
    llm_reasoning_budget: null,
    llm_chat_template_path: null,
    llm_use_jinja: true,
    llm_cache_prompt: true,
    llm_flash_attn: false,
    max_tokens: 256,
    temperature: 0,
    top_p: null,
    top_k: null,
    repeat_penalty: null,
    request_seed: null,
    use_fake_reply: false,
    fake_reply_text: null,
    llm_log_outbound_payload: false,
    bulk_llm_recycle_policy: 'never',
    ...overrides
  };
}

async function createMinimalDocx(filePath: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    <w:p><w:r><w:t>Introduction paragraph.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Body paragraph one.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Conclusion paragraph.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buffer);
}

async function createEssayFeedbackService() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-essay-feedback-'));
  const sourcePath = path.join(tempDir, 'essay.docx');
  await createMinimalDocx(sourcePath);

  const createSession = vi.fn().mockResolvedValue({
    sessionId: 'essay-feedback:file-1:1',
    fileEntityUuid: 'file-1'
  });
  const appendTurns = vi.fn().mockResolvedValue(undefined);
  const addMessage = vi.fn().mockResolvedValue(undefined);
  const upsertIdentifiedParagraphs = vi.fn().mockResolvedValue(undefined);
  const saveThesisStatement = vi.fn().mockResolvedValue(undefined);
  const addCompletion = vi.fn().mockResolvedValue(undefined);
  const requestActionStream = vi.fn().mockImplementation(async (action, _payload, onStreamEvent) => {
    if (action === 'llm.essay.feedback.identifyParagraphs') {
      onStreamEvent({
        requestId: 'llm-identify-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: 'essay-client-1:identify',
          channel: 'meta',
          text: 'Identifying introduction, body paragraphs, and conclusion...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-identify-1',
        ok: true,
        data: {
          introduction_paragraph: 'Introduction paragraph.',
          body_paragraphs: {
            items: [{ body_paragraph: 'Body paragraph one.' }]
          },
          conclusion_paragraph: 'Conclusion paragraph.'
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    onStreamEvent({
      requestId: 'llm-thesis-status-1',
      type: 'stream_chunk',
      data: {
        clientRequestId: 'essay-client-1:essay:1:thesis-statement-feedback',
        channel: 'meta',
        text: 'Extracting and evaluating the thesis statement...',
        done: false,
        seq: 1
      },
      timestamp: '2026-06-21T00:00:00.000Z'
    });

    return {
      requestId: 'llm-thesis-1',
      ok: true,
      data: {
        thesis_statement: 'Students should read more books.',
        verdict: 'Clear thesis, but it would be stronger with one concrete reason.',
        improvements: 'Add a specific reason students benefit from reading more books.'
      },
      timestamp: '2026-06-21T00:00:00.000Z'
    };
  });

  const service = new EssayFeedbackChatService({
    llmOrchestrator: {
      requestActionStream
    } as any,
    llmSettingsRepository: {
      getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
    } as any,
    llmSelectionRepository: {
      listCatalogModels: vi.fn().mockResolvedValue([]),
      getActiveModel: vi.fn().mockResolvedValue({ key: 'essay-model', displayName: 'Essay Model' }),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
    } as any,
    llmFeedbackCompletionRepository: {
      addCompletion
    } as any,
    essayFeedbackAnalysisRepository: {
      upsertIdentifiedParagraphs,
      saveThesisStatement,
      getIdentifiedParagraphs: vi.fn().mockResolvedValue(null)
    } as any,
    rubricRepository: {} as any,
    workspaceRepository: {
      resolveFileById: vi.fn().mockResolvedValue({
        id: 'file-1',
        path: sourcePath,
        name: 'essay.docx',
        kind: 'docx'
      })
    } as any,
    llmChatSessionRepository: {
      createSession,
      appendTurns
    } as any,
    repository: {
      addMessage
    } as any,
    fileExists: vi.fn().mockResolvedValue(true),
    isFile: vi.fn().mockResolvedValue(true),
    isExecutable: vi.fn().mockResolvedValue(true),
    resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
  });

  return {
    service,
    createSession,
    appendTurns,
    addMessage,
    requestActionStream,
    upsertIdentifiedParagraphs,
    saveThesisStatement,
    addCompletion
  };
}

describe('EssayFeedbackChatService', () => {
  it('identifies essay sections before returning selected feedback stubs', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const {
      service,
      createSession,
      appendTurns,
      addMessage,
      requestActionStream,
      upsertIdentifiedParagraphs,
      addCompletion
    } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['summary-feedback', 'conclusion-final-comment']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(1);
    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(result.essayFeedback?.replies.map((reply) => reply.essayFeedbackType)).toEqual([
      'summary-feedback',
      'conclusion-final-comment'
    ]);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession.mock.invocationCallOrder[0]).toBeLessThan(upsertIdentifiedParagraphs.mock.invocationCallOrder[0]);
    expect(upsertIdentifiedParagraphs).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      {
        introductionParagraph: 'Introduction paragraph.',
        bodyParagraphs: [{ body_paragraph: 'Body paragraph one.' }],
        conclusionParagraph: 'Conclusion paragraph.'
      }
    );
    expect(addCompletion).toHaveBeenCalledWith({
      fileId: 'file-1',
      workflowKey: 'essay_feedback',
      modelKey: 'essay-model',
      modelDisplayName: 'Essay Model',
      sessionId: expect.stringContaining('essay-feedback:file-1:')
    });
    expect(appendTurns).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content:
            'Stub: Summary feedback is queued for essay.docx (docx) using the identified conclusion paragraph.'
        }
      ],
      'file-1'
    );
    expect(appendTurns).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content:
            'Stub: Conclusion final comment is queued for essay.docx (docx) using the identified conclusion paragraph.'
        }
      ],
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(
      emittedEvents.map((event) => ({
        type: event.type,
        stage: event.essayFeedbackStage,
        feedbackType: event.essayFeedbackType,
        channel: event.channel
      }))
    ).toEqual([
      { type: 'start', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'status', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'done', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'start', stage: undefined, feedbackType: 'summary-feedback', channel: 'meta' },
      { type: 'chunk', stage: undefined, feedbackType: 'summary-feedback', channel: 'content' },
      { type: 'done', stage: undefined, feedbackType: 'summary-feedback', channel: 'meta' },
      { type: 'start', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'meta' },
      { type: 'chunk', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'content' },
      { type: 'done', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'meta' }
    ]);
  });

  it('emits verdict and improvements bubbles for thesis statement feedback with inline comment payloads', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, requestActionStream, saveThesisStatement, addCompletion } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['thesis-statement-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(2);
    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(result.essayFeedback?.replies?.map((reply) => reply.essayFeedbackSection)).toEqual([
      'verdict',
      'improvements'
    ]);
    expect(result.essayFeedback?.replies?.map((reply) => reply.inlineComment)).toEqual([
      {
        searchText: 'Students should read more books.',
        commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
      },
      {
        searchText: 'Students should read more books.',
        commentText: 'Add a specific reason students benefit from reading more books.'
      }
    ]);
    expect(saveThesisStatement).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      'Students should read more books.'
    );
    expect(addCompletion).toHaveBeenCalledWith({
      fileId: 'file-1',
      workflowKey: 'essay_feedback',
      modelKey: 'essay-model',
      modelDisplayName: 'Essay Model',
      sessionId: expect.stringContaining('essay-feedback:file-1:')
    });
    expect(appendTurns).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content:
            '### Thesis Statement Feedback\nVerdict: Clear thesis, but it would be stronger with one concrete reason.',
          metadata: {
            feedbackType: 'thesis-statement-feedback',
            inlineComment: {
              searchText: 'Students should read more books.',
              commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
            }
          }
        },
        {
          role: 'assistant',
          content:
            '### Thesis Statement Feedback\nImprovements: Add a specific reason students benefit from reading more books.',
          metadata: {
            feedbackType: 'thesis-statement-feedback',
            inlineComment: {
              searchText: 'Students should read more books.',
              commentText: 'Add a specific reason students benefit from reading more books.'
            }
          }
        }
      ],
      'file-1'
    );
    expect(
      emittedEvents
        .filter((event) => event.type === 'chunk')
        .map((event) => ({
          section: event.essayFeedbackSection,
          inlineComment: event.inlineComment
        }))
    ).toEqual([
      {
        section: 'verdict',
        inlineComment: {
          searchText: 'Students should read more books.',
          commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
        }
      },
      {
        section: 'improvements',
        inlineComment: {
          searchText: 'Students should read more books.',
          commentText: 'Add a specific reason students benefit from reading more books.'
        }
      }
    ]);
  });

  it('does not create a session for unsupported non-docx files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-essay-feedback-pdf-'));
    const sourcePath = path.join(tempDir, 'essay.pdf');
    await fs.writeFile(sourcePath, Buffer.from('fake'));

    const createSession = vi.fn().mockResolvedValue({
      sessionId: 'essay-feedback:file-1:1',
      fileEntityUuid: 'file-1'
    });
    const upsertIdentifiedParagraphs = vi.fn();
    const service = new EssayFeedbackChatService({
      llmOrchestrator: { requestActionStream: vi.fn() } as any,
      llmSettingsRepository: {
        getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
      } as any,
      llmSelectionRepository: {
        listCatalogModels: vi.fn().mockResolvedValue([]),
        getActiveModel: vi.fn().mockResolvedValue({ key: 'essay-model', displayName: 'Essay Model' }),
        resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
      } as any,
      llmFeedbackCompletionRepository: {
        addCompletion: vi.fn()
      } as any,
      essayFeedbackAnalysisRepository: {
        upsertIdentifiedParagraphs,
        saveThesisStatement: vi.fn(),
        getIdentifiedParagraphs: vi.fn().mockResolvedValue(null)
      } as any,
      rubricRepository: {} as any,
      workspaceRepository: {
        resolveFileById: vi.fn().mockResolvedValue({
          id: 'file-1',
          path: sourcePath,
          name: 'essay.pdf',
          kind: 'pdf'
        })
      } as any,
      llmChatSessionRepository: {
        createSession,
        appendTurns: vi.fn()
      } as any,
      repository: {
        addMessage: vi.fn()
      } as any,
      fileExists: vi.fn().mockResolvedValue(true),
      isFile: vi.fn().mockResolvedValue(true),
      isExecutable: vi.fn().mockResolvedValue(true),
      resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
    });

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-unsupported',
        selectedFeedbackTypes: ['summary-feedback']
      },
      () => {}
    );

    expect(createSession).not.toHaveBeenCalled();
    expect(upsertIdentifiedParagraphs).not.toHaveBeenCalled();
    expect(result.essayFeedback?.replies).toEqual([]);
  });

  it('does not throw when completion tracking fails after replies are persisted', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, addCompletion } = await createEssayFeedbackService();
    addCompletion.mockRejectedValueOnce(new Error('CHECK constraint failed'));

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-completion-failure',
        selectedFeedbackTypes: ['summary-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(result.essayFeedback?.replies).toHaveLength(1);
    expect(result.essayFeedback?.failures).toEqual([]);
    expect(
      emittedEvents.some(
        (event) =>
          event.type === 'error' &&
          event.error &&
          (event.error as { code?: string }).code === 'ESSAY_FEEDBACK_COMPLETION_PERSIST_FAILED'
      )
    ).toBe(true);
  });

  it('returns a per-file failure instead of throwing when reply persistence fails', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, addCompletion } = await createEssayFeedbackService();
    appendTurns.mockRejectedValueOnce(new Error('disk full'));

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-persist-failure',
        selectedFeedbackTypes: ['summary-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(result.essayFeedback?.replies).toHaveLength(0);
    expect(result.essayFeedback?.failures).toHaveLength(1);
    expect(result.essayFeedback?.failures?.[0]?.reason).toBe(
      'disk full'
    );
    expect(addCompletion).not.toHaveBeenCalled();
    expect(
      emittedEvents.some(
        (event) =>
          event.type === 'error' &&
          event.error &&
          (event.error as { code?: string }).code === 'ESSAY_FEEDBACK_STAGE_FAILED'
      )
    ).toBe(true);
  });
});
