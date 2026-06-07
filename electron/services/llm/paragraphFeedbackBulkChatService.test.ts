import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { ParagraphFeedbackBulkChatService } from './paragraphFeedbackBulkChatService';

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
    <w:p><w:r><w:t>Student paragraph text.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buffer);
}

async function createService(
  reply: string,
  runtimeSettings: LlmRuntimeSettings = buildRuntimeSettings(),
  options: {
    activeModel?: { key: string; displayName: string } | null;
    completedFileIds?: string[];
    redoCompletedFileIds?: string[];
  } = {}
) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-paragraph-feedback-'));
  const sourcePath = path.join(tempDir, 'source.docx');
  await createMinimalDocx(sourcePath);

  const appendTurns = vi.fn().mockResolvedValue(undefined);
  const addMessage = vi.fn().mockResolvedValue(undefined);
  const requestActionStream = vi.fn().mockResolvedValue({
    requestId: 'llm-request-1',
    ok: true,
    data: { reply },
    timestamp: '2026-02-24T00:00:00.000Z'
  });
  const requestAction = vi.fn().mockResolvedValue({
    requestId: 'stop-request-1',
    ok: true,
    data: { stopped: true, hasRuntime: false, serverRunning: false },
    timestamp: '2026-02-24T00:00:00.000Z'
  });
  const activeModel = options.activeModel ?? null;
  const listCompletedForFiles = vi.fn().mockResolvedValue(
    (options.completedFileIds ?? []).map((fileId) => ({
      id: `completion-${fileId}`,
      fileId,
      workflowKey: 'paragraph_feedback',
      modelKey: activeModel?.key ?? 'model-1',
      modelDisplayName: activeModel?.displayName ?? 'Model 1',
      sessionId: `session-${fileId}`,
      completedAt: '2026-02-24T00:00:00.000Z'
    }))
  );
  const addCompletion = vi.fn().mockResolvedValue(undefined);

  const service = new ParagraphFeedbackBulkChatService({
    llmOrchestrator: {
      requestAction,
      requestActionStream
    } as any,
    llmSettingsRepository: {
      getRuntimeSettings: vi.fn().mockResolvedValue(runtimeSettings)
    } as any,
    llmChatSessionRepository: {
      createSession: vi.fn().mockResolvedValue(undefined),
      appendTurns
    } as any,
    llmSelectionRepository: {
      listCatalogModels: vi.fn().mockResolvedValue(
        activeModel
          ? [
              {
                key: activeModel.key,
                displayName: activeModel.displayName,
                hfRepoId: 'repo',
                hfFilename: 'model.gguf',
                mmprojFilename: null,
                backend: 'server',
                modelFamily: 'instruct/think',
                chatTemplateAsset: activeModel.key.startsWith('gemma') ? 'models/gemma_4_chat_template.jinja' : null
              }
            ]
          : []
      ),
      getActiveModel: vi.fn().mockResolvedValue(activeModel),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
    } as any,
    llmFeedbackCompletionRepository: {
      listCompletedForFiles,
      addCompletion
    } as any,
    workspaceRepository: {
      resolveFileById: vi.fn().mockResolvedValue({
        id: 'file-1',
        path: sourcePath,
        name: 'source.docx',
        kind: 'docx'
      })
    } as any,
    repository: {
      addMessage
    } as any,
    rubricRepository: {} as any,
    fileExists: vi.fn().mockResolvedValue(true),
    isFile: vi.fn().mockResolvedValue(true),
    isExecutable: vi.fn().mockResolvedValue(true),
    resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
  });

  return { service, appendTurns, addMessage, requestAction, requestActionStream, listCompletedForFiles, addCompletion };
}

describe('ParagraphFeedbackBulkChatService', () => {
  it('splits structured paragraph feedback into separate verdict, reason, and revision bubbles', async () => {
    const structuredReply = JSON.stringify({
      paragraph_feedback: {
        topic_sentence: {
          verdict: 'Topic verdict',
          reason: 'Topic reason',
          revision_suggestion: 'Topic revision'
        },
        coherence: {
          verdict: 'Coherence verdict',
          reason: 'Coherence reason',
          revision_suggestion: 'Coherence revision'
        }
      }
    });
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, addMessage } = await createService(structuredReply);

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    const replies = result.paragraphFeedbackBulk?.replies ?? [];
    expect(replies).toHaveLength(6);
    expect(replies.map((reply) => reply.reply)).toEqual([
      '### Topic Sentence\nVerdict: Topic verdict',
      '### Topic Sentence\nReason: Topic reason',
      '### Topic Sentence\nRevision suggestion: Topic revision',
      '### Coherence\nVerdict: Coherence verdict',
      '### Coherence\nReason: Coherence reason',
      '### Coherence\nRevision suggestion: Coherence revision'
    ]);
    expect(replies.map((reply) => reply.feedbackSection)).toEqual([
      'verdict',
      'reason',
      'revision_suggestion',
      'verdict',
      'reason',
      'revision_suggestion'
    ]);
    expect(replies.map((reply) => reply.feedbackType)).toEqual([
      'topic_sentence',
      'topic_sentence',
      'topic_sentence',
      'coherence',
      'coherence',
      'coherence'
    ]);
    expect(new Set(replies.map((reply) => reply.clientRequestId)).size).toBe(6);
    expect(appendTurns).toHaveBeenCalledWith(
      expect.any(String),
      replies.map((reply) => ({ role: 'assistant', content: reply.reply })),
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(6);
    expect(emittedEvents.filter((event) => event.type === 'chunk')).toHaveLength(6);
    expect(
      emittedEvents.filter(
        (event) => event.type === 'chunk' && event.feedbackSection === 'revision_suggestion'
      )
    ).toHaveLength(2);
  });

  it('reports and persists leaked reasoning as a diagnostic reply without blocking feedback', async () => {
    const structuredReply = JSON.stringify({
      paragraph_feedback: {
        topic_sentence: {
          verdict: 'Topic verdict',
          reason: 'Topic reason',
          revision_suggestion: 'Topic revision'
        },
        coherence: {
          verdict: 'Coherence verdict',
          reason: 'Coherence reason',
          revision_suggestion: 'Coherence revision'
        }
      },
      reasoning_leak: {
        warning: 'Reasoning output was detected unexpectedly during paragraph feedback. Gemma appears to have entered thinking mode.',
        reasoning_content: 'Hidden reasoning content.'
      }
    });
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, requestActionStream, appendTurns, addMessage } = await createService(structuredReply);
    requestActionStream.mockImplementationOnce(async (_action, _payload, onStreamEvent) => {
      onStreamEvent({
        requestId: 'llm-request-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: 'bulk-client-1:paragraph:1',
          channel: 'meta',
          text: 'Warning: reasoning output was detected unexpectedly during paragraph feedback. Gemma appears to have entered thinking mode.',
          done: false,
          seq: 10
        }
      });
      return {
        requestId: 'llm-request-1',
        ok: true,
        data: { reply: structuredReply },
        timestamp: '2026-02-24T00:00:00.000Z'
      };
    });

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    const replies = result.paragraphFeedbackBulk?.replies ?? [];
    expect(replies).toHaveLength(7);
    expect(replies.at(-1)).toEqual(
      expect.objectContaining({
        diagnosticType: 'reasoning_leak'
      })
    );
    expect(replies.at(-1)?.reply).toContain('### Diagnostic Warning');
    expect(replies.at(-1)?.reply).toContain('Hidden reasoning content.');
    expect(appendTurns).toHaveBeenCalledWith(
      expect.any(String),
      replies.map((reply) => ({ role: 'assistant', content: reply.reply })),
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(7);
    expect(emittedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'status',
          text: 'Warning: reasoning output was detected unexpectedly during paragraph feedback. Gemma appears to have entered thinking mode.'
        })
      ])
    );
  });

  it('keeps one fallback bubble when paragraph feedback is not structured JSON', async () => {
    const { service, appendTurns, addMessage } = await createService('Plain fallback paragraph feedback.');

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      vi.fn()
    );

    const replies = result.paragraphFeedbackBulk?.replies ?? [];
    expect(replies).toHaveLength(1);
    expect(replies[0]).toEqual(
      expect.objectContaining({
        reply: 'Plain fallback paragraph feedback.',
        clientRequestId: 'bulk-client-1:paragraph:1:fallback'
      })
    );
    expect(replies[0]).not.toHaveProperty('feedbackType');
    expect(replies[0]).not.toHaveProperty('feedbackSection');
    expect(appendTurns).toHaveBeenCalledWith(
      expect.any(String),
      [{ role: 'assistant', content: 'Plain fallback paragraph feedback.' }],
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(1);
  });

  it('recycles the LLM runtime after each generated bulk file when configured', async () => {
    const { service, requestAction, requestActionStream } = await createService(
      'Plain fallback paragraph feedback.',
      buildRuntimeSettings({ bulk_llm_recycle_policy: 'after_each_file' })
    );

    await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      vi.fn()
    );

    expect(requestActionStream).toHaveBeenCalledTimes(1);
    expect(requestAction).toHaveBeenCalledWith('llm.server.stop', {});
  });

  it('records paragraph feedback completion after successful persistence for the active model', async () => {
    const { service, addCompletion } = await createService('Plain fallback paragraph feedback.', buildRuntimeSettings(), {
      activeModel: { key: 'gemma4_e4b_it_q4_k_m', displayName: 'Gemma 4 E4B Instruct Q4_K_M' }
    });

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      vi.fn()
    );

    expect(result.paragraphFeedbackBulk?.skippedFileIds).toEqual([]);
    expect(addCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        fileId: 'file-1',
        workflowKey: 'paragraph_feedback',
        modelKey: 'gemma4_e4b_it_q4_k_m',
        modelDisplayName: 'Gemma 4 E4B Instruct Q4_K_M',
        sessionId: expect.stringContaining('paragraph-feedback:file-1:')
      })
    );
  });

  it('skips same-model completed files unless redo is requested', async () => {
    const { service, requestActionStream, addCompletion } = await createService('Should not run.', buildRuntimeSettings(), {
      activeModel: { key: 'qwen3_4b_q8', displayName: 'Qwen3 4B Q8_0' },
      completedFileIds: ['file-1']
    });

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      vi.fn()
    );

    expect(result.paragraphFeedbackBulk?.replies).toHaveLength(0);
    expect(result.paragraphFeedbackBulk?.skippedFileIds).toEqual(['file-1']);
    expect(requestActionStream).not.toHaveBeenCalled();
    expect(addCompletion).not.toHaveBeenCalled();
  });

  it('redoes same-model completed files in a new session when redo is requested', async () => {
    const { service, requestActionStream, addCompletion } = await createService('Plain fallback paragraph feedback.', buildRuntimeSettings(), {
      activeModel: { key: 'qwen3_4b_q8', displayName: 'Qwen3 4B Q8_0' },
      completedFileIds: ['file-1']
    });

    const result = await service.sendMessage(
      {
        kind: 'paragraph-feedback-bulk',
        fileIds: ['file-1'],
        redoCompletedFileIds: ['file-1'],
        clientRequestId: 'bulk-client-1'
      },
      vi.fn()
    );

    expect(result.paragraphFeedbackBulk?.replies).toHaveLength(1);
    expect(result.paragraphFeedbackBulk?.skippedFileIds).toEqual([]);
    expect(requestActionStream).toHaveBeenCalledTimes(1);
    expect(addCompletion).toHaveBeenCalledTimes(1);
  });
});
