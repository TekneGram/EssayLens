import { describe, expect, it, vi } from 'vitest';
import { getLlmNotReadyDetails } from './llmRuntimeReadiness';
import type { LlmRuntimeSettings } from '../ipc/contracts/llmManager.contracts';

function buildSettings(overrides: Partial<LlmRuntimeSettings> = {}): LlmRuntimeSettings {
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

describe('getLlmNotReadyDetails', () => {
  it('reports a missing configured chat template file', async () => {
    const details = await getLlmNotReadyDetails(
      buildSettings({
        llm_chat_template_path: '/tmp/gemma_4_chat_template.jinja'
      }),
      {
        fileExists: vi.fn(async (targetPath: string) => targetPath !== '/tmp/gemma_4_chat_template.jinja'),
        isFile: vi.fn().mockResolvedValue(true),
        isExecutable: vi.fn().mockResolvedValue(true)
      }
    );

    expect(details?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CHAT_TEMPLATE_FILE_NOT_FOUND',
          path: '/tmp/gemma_4_chat_template.jinja'
        })
      ])
    );
  });

  it('does not require a chat template path when the model uses the default setup', async () => {
    const details = await getLlmNotReadyDetails(buildSettings(), {
      fileExists: vi.fn().mockResolvedValue(true),
      isFile: vi.fn().mockResolvedValue(true),
      isExecutable: vi.fn().mockResolvedValue(true)
    });

    expect(details).toBeNull();
  });
});
