import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { ParagraphFeedbackBulkChatService } from './paragraphFeedbackBulkChatService';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildRuntimeSettings(): LlmRuntimeSettings {
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
    fake_reply_text: null
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

async function createService(reply: string) {
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

  const service = new ParagraphFeedbackBulkChatService({
    llmOrchestrator: {
      requestAction: vi.fn(),
      requestActionStream
    } as any,
    llmSettingsRepository: {
      getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
    } as any,
    llmChatSessionRepository: {
      createSession: vi.fn().mockResolvedValue(undefined),
      appendTurns
    } as any,
    llmSelectionRepository: {
      getActiveModel: vi.fn().mockResolvedValue(null),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
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

  return { service, appendTurns, addMessage, requestActionStream };
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
});
