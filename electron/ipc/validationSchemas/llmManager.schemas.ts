import { z } from 'zod';

const llmModelKeySchema = z.string().trim().min(1);

const llmRuntimeSettingsPartialSchema = z.object({
  llm_server_path: z.string().optional(),
  llm_gguf_path: z.string().nullable().optional(),
  llm_mmproj_path: z.string().nullable().optional(),
  llm_server_url: z.string().optional(),
  llm_host: z.string().optional(),
  llm_port: z.number().int().optional(),
  llm_n_ctx: z.number().int().optional(),
  llm_n_threads: z.number().int().nullable().optional(),
  llm_n_gpu_layers: z.number().int().nullable().optional(),
  llm_n_batch: z.number().int().nullable().optional(),
  llm_n_parallel: z.number().int().nullable().optional(),
  llm_seed: z.number().int().nullable().optional(),
  llm_rope_freq_base: z.number().nullable().optional(),
  llm_rope_freq_scale: z.number().nullable().optional(),
  llm_model_family: z.string().optional(),
  llm_chat_template_path: z.string().nullable().optional(),
  llm_use_jinja: z.boolean().optional(),
  llm_cache_prompt: z.boolean().optional(),
  llm_flash_attn: z.boolean().optional(),
  max_tokens: z.number().int().optional(),
  temperature: z.number().optional(),
  top_p: z.number().nullable().optional(),
  top_k: z.number().int().nullable().optional(),
  repeat_penalty: z.number().nullable().optional(),
  request_seed: z.number().int().nullable().optional(),
  use_fake_reply: z.boolean().optional(),
  fake_reply_text: z.string().nullable().optional(),
  bulk_llm_recycle_policy: z.enum(['never', 'after_each_file']).optional()
});

export const llmManagerSchemas = {
  listCatalogModels: z.object({}).optional(),
  listDownloadedModels: z.object({}).optional(),
  getActiveModel: z.object({}).optional(),
  selectModel: z.object({
    key: llmModelKeySchema
  }),
  downloadModel: z.object({
    key: llmModelKeySchema
  }),
  deleteDownloadedModel: z.object({
    key: llmModelKeySchema,
    deleteFiles: z.boolean().optional()
  }),
  getSettings: z.object({}).optional(),
  updateSettings: z.object({
    settings: llmRuntimeSettingsPartialSchema
  }),
  resetSettingsToDefaults: z.object({}).optional()
};
