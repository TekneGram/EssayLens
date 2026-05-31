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
  it('splits supporting sentence feedback into type-specific bubbles when category judgments are present', async () => {
    const structuredReply = JSON.stringify({
      paragraph_feedback: {
        topic_sentence: {
          verdict: 'Topic verdict',
          reason: 'Topic reason',
          revision_suggestion: 'Topic revision'
        },
        supporting_sentences: {
          verdict: 'Support verdict',
          reason: 'Support reason',
          revision_suggestion: 'Support revision',
          supporting_sentence_types: [
            { kind: 'facts', extracted_text: 'Fact sentence.', verdict: 'Facts verdict', reason: 'Facts reason' },
            { kind: 'definitions', extracted_text: 'Definition sentence.', verdict: 'Definitions verdict', reason: 'Definitions reason' },
            { kind: 'examples', extracted_text: 'Example sentence.', verdict: 'Examples verdict', reason: 'Examples reason' },
            { kind: 'descriptions', extracted_text: 'Description sentence.', verdict: 'Descriptions verdict', reason: 'Descriptions reason' }
          ]
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
    expect(replies).toHaveLength(15);
    expect(replies.map((reply) => reply.reply)).toEqual([
      '### Topic Sentence\nVerdict: Topic verdict',
      '### Topic Sentence\nReason: Topic reason',
      '### Topic Sentence\nRevision suggestion: Topic revision',
      '### Supporting Sentences: Facts\nExtracted facts: Fact sentence.',
      '### Supporting Sentences: Facts\nVerdict: Facts verdict\nReason: Facts reason',
      '### Supporting Sentences: Definitions\nExtracted definitions: Definition sentence.',
      '### Supporting Sentences: Definitions\nVerdict: Definitions verdict\nReason: Definitions reason',
      '### Supporting Sentences: Examples\nExtracted examples: Example sentence.',
      '### Supporting Sentences: Examples\nVerdict: Examples verdict\nReason: Examples reason',
      '### Supporting Sentences: Descriptions\nExtracted descriptions: Description sentence.',
      '### Supporting Sentences: Descriptions\nVerdict: Descriptions verdict\nReason: Descriptions reason',
      '### Supporting Sentences\nRevision suggestion: Support revision',
      '### Coherence\nVerdict: Coherence verdict',
      '### Coherence\nReason: Coherence reason',
      '### Coherence\nRevision suggestion: Coherence revision'
    ]);
    expect(replies.map((reply) => reply.supportingSentenceType)).toEqual([
      undefined,
      undefined,
      undefined,
      'facts',
      'facts',
      'definitions',
      'definitions',
      'examples',
      'examples',
      'descriptions',
      'descriptions',
      undefined,
      undefined,
      undefined,
      undefined
    ]);
    expect(replies.filter((reply) => reply.feedbackType === 'supporting_sentences')).toHaveLength(9);
    expect(replies.filter((reply) => reply.feedbackSection === 'extracted_text')).toHaveLength(4);
    expect(replies.filter((reply) => reply.feedbackSection === 'revision_suggestion')).toHaveLength(3);
    expect(appendTurns).toHaveBeenCalledWith(
      expect.any(String),
      replies.map((reply) => ({ role: 'assistant', content: reply.reply })),
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(15);
    expect(emittedEvents.filter((event) => event.type === 'chunk')).toHaveLength(15);
    expect(emittedEvents.filter((event) => event.supportingSentenceType === 'definitions')).toHaveLength(4);
  });

  it('splits structured paragraph feedback into separate verdict, reason, and revision bubbles', async () => {
    const structuredReply = JSON.stringify({
      paragraph_feedback: {
        topic_sentence: {
          verdict: 'Topic verdict',
          reason: 'Topic reason',
          revision_suggestion: 'Topic revision'
        },
        supporting_sentences: {
          verdict: 'Support verdict',
          reason: 'Support reason',
          revision_suggestion: 'Support revision'
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
    expect(replies).toHaveLength(9);
    expect(replies.map((reply) => reply.reply)).toEqual([
      '### Topic Sentence\nVerdict: Topic verdict',
      '### Topic Sentence\nReason: Topic reason',
      '### Topic Sentence\nRevision suggestion: Topic revision',
      '### Supporting Sentences\nVerdict: Support verdict',
      '### Supporting Sentences\nReason: Support reason',
      '### Supporting Sentences\nRevision suggestion: Support revision',
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
      'revision_suggestion',
      'verdict',
      'reason',
      'revision_suggestion'
    ]);
    expect(new Set(replies.map((reply) => reply.clientRequestId)).size).toBe(9);
    expect(appendTurns).toHaveBeenCalledWith(
      expect.any(String),
      replies.map((reply) => ({ role: 'assistant', content: reply.reply })),
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(9);
    expect(emittedEvents.filter((event) => event.type === 'chunk')).toHaveLength(9);
    expect(emittedEvents.filter((event) => event.feedbackSection === 'revision_suggestion')).toHaveLength(6);
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
