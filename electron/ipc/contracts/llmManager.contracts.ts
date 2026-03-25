export type LlmModelKey = 'qwen3_4b_q8' | 'qwen3_8b_q8';
export type LlmBackend = 'server';
export type LlmModelFamily = 'instruct/think';

export interface CatalogLlmModelDto {
  key: LlmModelKey;
  displayName: string;
  hfRepoId: string;
  hfFilename: string;
  mmprojFilename: string | null;
  backend: LlmBackend;
  modelFamily: LlmModelFamily;
}

export interface DownloadedLlmModelDto {
  key: LlmModelKey;
  displayName: string;
  localGgufPath: string;
  localMmprojPath: string | null;
  downloadedAt: string;
  isActive: boolean;
}

export interface LlmRuntimeSettings {
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
  llm_use_jinja: boolean;
  llm_cache_prompt: boolean;
  llm_flash_attn: boolean;
  max_tokens: number;
  temperature: number;
  top_p: number | null;
  top_k: number | null;
  repeat_penalty: number | null;
  request_seed: number | null;
  use_fake_reply: boolean;
  fake_reply_text: string | null;
}

export interface ListCatalogModelsRequest {}

export interface ListCatalogModelsResponse {
  models: CatalogLlmModelDto[];
}

export interface ListDownloadedModelsRequest {}

export interface ListDownloadedModelsResponse {
  models: DownloadedLlmModelDto[];
}

export interface GetActiveModelRequest {}

export interface GetActiveModelResponse {
  model: DownloadedLlmModelDto | null;
}

export interface SelectModelRequest {
  key: LlmModelKey;
}

export interface DownloadModelRequest {
  key: LlmModelKey;
}

export interface DownloadModelResponse {
  model: DownloadedLlmModelDto;
}

export type DownloadProgressPhase = 'starting' | 'downloading' | 'persisting' | 'completed' | 'failed';

export interface DownloadProgressEvent {
  key: LlmModelKey;
  phase: DownloadProgressPhase;
  bytesReceived: number;
  bytesTotal: number | null;
  percent: number | null;
  status: string;
  errorMessage: string | null;
}

export interface DeleteDownloadedModelRequest {
  key: LlmModelKey;
  deleteFiles?: boolean;
}

export interface DeleteDownloadedModelResponse {
  deletedKey: LlmModelKey;
  removedFromDisk: boolean;
}

export interface SelectModelResponse {
  activeModel: DownloadedLlmModelDto;
  settings: LlmRuntimeSettings;
}

export interface GetSettingsRequest {}

export interface GetSettingsResponse {
  settings: LlmRuntimeSettings;
}

export interface UpdateSettingsRequest {
  settings: Partial<LlmRuntimeSettings>;
}

export interface UpdateSettingsResponse {
  settings: LlmRuntimeSettings;
}

export interface ResetSettingsToDefaultsRequest {}

export interface ResetSettingsToDefaultsResponse {
  activeModel: DownloadedLlmModelDto;
  settings: LlmRuntimeSettings;
}
