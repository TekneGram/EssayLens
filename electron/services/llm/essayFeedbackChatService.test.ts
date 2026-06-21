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
  const requestActionStream = vi.fn().mockImplementation(async (_action, _payload, onStreamEvent) => {
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
      getActiveModel: vi.fn().mockResolvedValue(null),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
    } as any,
    llmFeedbackCompletionRepository: {} as any,
    essayFeedbackAnalysisRepository: {
      upsertIdentifiedParagraphs,
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
    upsertIdentifiedParagraphs
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
      upsertIdentifiedParagraphs
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
    expect(upsertIdentifiedParagraphs).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      {
        introductionParagraph: 'Introduction paragraph.',
        bodyParagraphs: [{ body_paragraph: 'Body paragraph one.' }],
        conclusionParagraph: 'Conclusion paragraph.'
      }
    );
    expect(appendTurns).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content:
            'Stub: Summary feedback is queued for essay.docx (docx) using the identified conclusion paragraph.'
        },
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
});
