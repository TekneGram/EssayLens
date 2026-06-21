import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { EssayFeedbackBulkChatService } from './essayFeedbackBulkChatService';

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
    bulk_llm_recycle_policy: 'after_each_file',
    ...overrides
  };
}

async function createMinimalDocx(filePath: string, intro: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    <w:p><w:r><w:t>${intro}</w:t></w:r></w:p>
    <w:p><w:r><w:t>Body paragraph one.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Conclusion paragraph.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buffer);
}

async function createBulkService() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-essay-feedback-bulk-'));
  const firstPath = path.join(tempDir, 'essay-1.docx');
  const secondPath = path.join(tempDir, 'essay-2.docx');
  await createMinimalDocx(firstPath, 'Introduction one.');
  await createMinimalDocx(secondPath, 'Introduction two.');

  const requestActionStream = vi.fn().mockImplementation(async (action, payload, onStreamEvent) => {
    if (action === 'llm.essay.feedback.identifyParagraphs') {
      onStreamEvent({
        requestId: `${payload.clientRequestId}:status`,
        type: 'stream_chunk',
        data: {
          clientRequestId: payload.clientRequestId,
          channel: 'meta',
          text: 'Identifying introduction, body paragraphs, and conclusion...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: `${payload.clientRequestId}:ok`,
        ok: true,
        data: {
          introduction_paragraph: payload.essay.includes('Introduction two.') ? 'Introduction two.' : 'Introduction one.',
          body_paragraphs: {
            items: [{ body_paragraph: 'Body paragraph one.' }]
          },
          conclusion_paragraph: 'Conclusion paragraph.'
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    return {
      requestId: `${payload.clientRequestId}:ok`,
      ok: true,
      data: {
        thesis_statement: 'Students should read more books.',
        verdict: 'Clear thesis.',
        improvements: 'Add one concrete reason.'
      },
      timestamp: '2026-06-21T00:00:00.000Z'
    };
  });
  const requestAction = vi.fn().mockResolvedValue({
    requestId: 'stop-1',
    ok: true,
    data: { stopped: true, hasRuntime: false, serverRunning: false },
    timestamp: '2026-06-21T00:00:00.000Z'
  });

  const service = new EssayFeedbackBulkChatService({
    llmOrchestrator: { requestActionStream, requestAction } as any,
    llmSettingsRepository: {
      getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
    } as any,
    llmSelectionRepository: {
      listCatalogModels: vi.fn().mockResolvedValue([]),
      getActiveModel: vi.fn().mockResolvedValue({ key: 'essay-model', displayName: 'Essay Model' }),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
    } as any,
    llmFeedbackCompletionRepository: {
      listCompletedForFiles: vi.fn().mockResolvedValue([]),
      addCompletion: vi.fn().mockResolvedValue(undefined)
    } as any,
    essayFeedbackAnalysisRepository: {
      upsertIdentifiedParagraphs: vi.fn().mockResolvedValue(undefined),
      saveThesisStatement: vi.fn().mockResolvedValue(undefined),
      getIdentifiedParagraphs: vi.fn().mockResolvedValue(null)
    } as any,
    rubricRepository: {} as any,
    workspaceRepository: {
      resolveFileById: vi.fn().mockImplementation(async (fileId: string) => ({
        id: fileId,
        path: fileId === 'file-1' ? firstPath : secondPath,
        name: fileId === 'file-1' ? 'essay-1.docx' : 'essay-2.docx',
        kind: 'docx'
      }))
    } as any,
    llmChatSessionRepository: {
      createSession: vi.fn().mockResolvedValue(undefined),
      appendTurns: vi.fn().mockResolvedValue(undefined)
    } as any,
    repository: {
      addMessage: vi.fn().mockResolvedValue(undefined)
    } as any,
    fileExists: vi.fn().mockResolvedValue(true),
    isFile: vi.fn().mockResolvedValue(true),
    isExecutable: vi.fn().mockResolvedValue(true),
    resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
  });

  return { service, requestAction, requestActionStream };
}

describe('EssayFeedbackBulkChatService', () => {
  it('processes files in one backend bulk request and recycles runtime after each file and batch', async () => {
    const { service, requestAction } = await createBulkService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback-bulk',
        fileIds: ['file-1', 'file-2'],
        selectedFeedbackTypes: ['summary-feedback']
      },
      () => {}
    );

    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(requestAction).toHaveBeenCalledTimes(3);
    expect(requestAction).toHaveBeenNthCalledWith(1, 'llm.server.stop', {});
    expect(requestAction).toHaveBeenNthCalledWith(2, 'llm.server.stop', {});
    expect(requestAction).toHaveBeenNthCalledWith(3, 'llm.server.stop', {});
  });
});
