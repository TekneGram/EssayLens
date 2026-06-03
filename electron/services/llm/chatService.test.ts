import { describe, expect, it, vi } from 'vitest';
import { ChatService } from './chatService';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';

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
    bulk_llm_recycle_policy: 'never'
  };
}

describe('ChatService rubric feedback', () => {
  it('runs rubric categories sequentially as one-shot rubric evaluations and persists each reply', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const llmCalls: Array<Record<string, unknown>> = [];
    const appendTurns = vi.fn().mockResolvedValue(undefined);
    const addMessage = vi.fn().mockResolvedValue(undefined);

    const service = new ChatService({
      llmOrchestrator: {
        requestAction: vi.fn(async (_action, payload) => {
          const index = llmCalls.length;
          llmCalls.push(payload as Record<string, unknown>);
          return {
            requestId: `req-${index}`,
            ok: true,
            data: { reply: `reply-${index + 1}` },
            timestamp: new Date().toISOString()
          };
        }),
        requestActionStream: vi.fn()
      } as any,
      llmSettingsRepository: {
        getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
      } as any,
      llmChatSessionRepository: {
        appendTurns
      } as any,
      llmSelectionRepository: {
        getActiveModel: vi.fn().mockResolvedValue(null),
        resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
      } as any,
      rubricRepository: {
        getRubricGradingContext: vi.fn().mockResolvedValue({
          fileId: 'file-1',
          selectedRubricIdForFile: 'rubric-1'
        }),
        getRubricMatrix: vi.fn().mockResolvedValue({
          rubric: {
            entityUuid: 'rubric-1',
            name: 'Standard',
            type: 'detailed',
            isActive: true,
            isArchived: false
          },
          details: [
            {
              uuid: 'content-5',
              entityUuid: 'rubric-1',
              category: 'content',
              description: 'The writing is fully engaging.'
            },
            {
              uuid: 'content-4',
              entityUuid: 'rubric-1',
              category: 'content',
              description: 'The writing is engaging.'
            },
            {
              uuid: 'language-5',
              entityUuid: 'rubric-1',
              category: 'language',
              description: 'Language is precise.'
            }
          ],
          scores: [
            { uuid: 'score-1', detailsUuid: 'content-5', scoreValues: 5 },
            { uuid: 'score-2', detailsUuid: 'content-4', scoreValues: 4 },
            { uuid: 'score-3', detailsUuid: 'language-5', scoreValues: 5 }
          ]
        })
      } as any,
      repository: {
        addMessage
      } as any,
      fileExists: vi.fn().mockResolvedValue(true),
      isFile: vi.fn().mockResolvedValue(true),
      isExecutable: vi.fn().mockResolvedValue(true),
      resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
    });

    const result = await service.sendMessage(
      {
        kind: 'rubric-feedback',
        fileId: 'file-1',
        essay: 'Student essay text.',
        clientRequestId: 'client-1'
      },
      (event) => {
        emittedEvents.push(event as unknown as Record<string, unknown>);
      }
    );

    expect(result.reply).toBe('reply-2');
    expect(result.rubricFeedback?.replies).toEqual([
      expect.objectContaining({
        category: 'content',
        reply: 'reply-1',
        clientRequestId: 'client-1:rubric:1:content'
      }),
      expect.objectContaining({
        category: 'language',
        reply: 'reply-2',
        clientRequestId: 'client-1:rubric:2:language'
      })
    ]);
    expect(llmCalls).toHaveLength(2);
    expect(llmCalls[0]).toEqual(
      expect.objectContaining({
        essay: 'Student essay text.',
        rubricCategory: 'content',
        rubricEntries: [
          { scoreValue: 5, description: 'The writing is fully engaging.' },
          { scoreValue: 4, description: 'The writing is engaging.' }
        ]
      })
    );
    expect(llmCalls[1]).toEqual(
      expect.objectContaining({
        essay: 'Student essay text.',
        rubricCategory: 'language',
        rubricEntries: [{ scoreValue: 5, description: 'Language is precise.' }]
      })
    );
    expect(appendTurns).toHaveBeenCalledTimes(2);
    expect(appendTurns.mock.calls[0][1]).toEqual([{ role: 'assistant', content: 'reply-1' }]);
    expect(appendTurns.mock.calls[1][1]).toEqual([{ role: 'assistant', content: 'reply-2' }]);
    expect(addMessage).toHaveBeenCalledTimes(2);
    expect(emittedEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ rubricCategory: 'content', type: 'start', seq: 1 }),
        expect.objectContaining({ rubricCategory: 'content', type: 'chunk', seq: 2, text: 'reply-1' }),
        expect.objectContaining({ rubricCategory: 'content', type: 'done', seq: 3 }),
        expect.objectContaining({ rubricCategory: 'language', type: 'start', seq: 1 }),
        expect.objectContaining({ rubricCategory: 'language', type: 'chunk', seq: 2, text: 'reply-2' }),
        expect.objectContaining({ rubricCategory: 'language', type: 'done', seq: 3 })
      ])
    );
  });
});
