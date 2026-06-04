import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';

export type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';

interface LlmSettingsRow {
  llm_server_path: string;
  llm_gguf_path: string | null;
  llm_mmproj_path: string | null;
  llm_server_url: string;
  llm_host: string;
  llm_port: number;
  llm_n_ctx: number;
  llm_n_threads: number | null;
  llm_n_gpu_layers: number | null;
  llm_n_batch: number | null;
  llm_n_parallel: number | null;
  llm_seed: number | null;
  llm_rope_freq_base: number | null;
  llm_rope_freq_scale: number | null;
  llm_model_family: string;
  llm_message_format: LlmRuntimeSettings['llm_message_format'];
  llm_reasoning_mode: string | null;
  llm_reasoning_budget: number | null;
  llm_chat_template_path: string | null;
  llm_use_jinja: number;
  llm_cache_prompt: number;
  llm_flash_attn: number;
  max_tokens: number;
  temperature: number;
  top_p: number | null;
  top_k: number | null;
  repeat_penalty: number | null;
  request_seed: number | null;
  use_fake_reply: number;
  fake_reply_text: string | null;
  bulk_llm_recycle_policy: LlmRuntimeSettings['bulk_llm_recycle_policy'];
}

export class LlmSettingsRepository {
  private readonly db: SQLiteClient;

  constructor(db: SQLiteClient = getSharedDatabaseClient()) {
    this.db = db;
  }

  async getRuntimeSettings(): Promise<LlmRuntimeSettings> {
    const row = await this.db.get<LlmSettingsRow>(
      `SELECT
         llm_server_path, llm_gguf_path, llm_mmproj_path,
         llm_server_url, llm_host, llm_port, llm_n_ctx,
         llm_n_threads, llm_n_gpu_layers, llm_n_batch, llm_n_parallel,
         llm_seed, llm_rope_freq_base, llm_rope_freq_scale,
         llm_model_family, llm_message_format, llm_reasoning_mode, llm_reasoning_budget, llm_chat_template_path,
         llm_use_jinja, llm_cache_prompt, llm_flash_attn,
         max_tokens, temperature, top_p, top_k, repeat_penalty, request_seed,
         use_fake_reply, fake_reply_text, bulk_llm_recycle_policy
       FROM llm_settings
       WHERE id = 'default'
       LIMIT 1;`
    );

    if (!row) {
      throw new Error('LLM settings are not initialized.');
    }

    return {
      llm_server_path: row.llm_server_path,
      llm_gguf_path: row.llm_gguf_path,
      llm_mmproj_path: row.llm_mmproj_path,
      llm_server_url: row.llm_server_url,
      llm_host: row.llm_host,
      llm_port: row.llm_port,
      llm_n_ctx: row.llm_n_ctx,
      llm_n_threads: row.llm_n_threads,
      llm_n_gpu_layers: row.llm_n_gpu_layers,
      llm_n_batch: row.llm_n_batch,
      llm_n_parallel: row.llm_n_parallel,
      llm_seed: row.llm_seed,
      llm_rope_freq_base: row.llm_rope_freq_base,
      llm_rope_freq_scale: row.llm_rope_freq_scale,
      llm_model_family: row.llm_model_family,
      llm_message_format: row.llm_message_format,
      llm_reasoning_mode: row.llm_reasoning_mode,
      llm_reasoning_budget: row.llm_reasoning_budget,
      llm_chat_template_path: row.llm_chat_template_path,
      llm_use_jinja: row.llm_use_jinja === 1,
      llm_cache_prompt: row.llm_cache_prompt === 1,
      llm_flash_attn: row.llm_flash_attn === 1,
      max_tokens: row.max_tokens,
      temperature: row.temperature,
      top_p: row.top_p,
      top_k: row.top_k,
      repeat_penalty: row.repeat_penalty,
      request_seed: row.request_seed,
      use_fake_reply: row.use_fake_reply === 1,
      fake_reply_text: row.fake_reply_text,
      bulk_llm_recycle_policy: row.bulk_llm_recycle_policy
    };
  }

  async updateRuntimeSettings(settings: Partial<LlmRuntimeSettings>): Promise<LlmRuntimeSettings> {
    const updates = Object.entries(settings) as Array<[keyof LlmRuntimeSettings, LlmRuntimeSettings[keyof LlmRuntimeSettings]]>;
    if (updates.length === 0) {
      return this.getRuntimeSettings();
    }

    const setClauses: string[] = [];
    const params: Array<string | number | null> = [];
    for (const [field, value] of updates) {
      setClauses.push(`${field} = ?`);
      params.push(this.toSqlValue(field, value));
    }
    params.push('default');

    await this.db.run(`UPDATE llm_settings SET ${setClauses.join(', ')} WHERE id = ?;`, params);
    return this.getRuntimeSettings();
  }

  private toSqlValue(
    field: keyof LlmRuntimeSettings,
    value: LlmRuntimeSettings[keyof LlmRuntimeSettings]
  ): string | number | null {
    if (field === 'llm_use_jinja' || field === 'llm_cache_prompt' || field === 'llm_flash_attn' || field === 'use_fake_reply') {
      return value ? 1 : 0;
    }
    return value as string | number | null;
  }
}
