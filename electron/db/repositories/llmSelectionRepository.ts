import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';
import type {
  CatalogLlmModelDto,
  DownloadedLlmModelDto,
  LlmModelKey,
  LlmRuntimeSettings
} from '../../../shared/llmManagerContracts';
import { LlmSettingsRepository } from './llmSettingsRepository';

interface LlmSelectionRepositoryOptions {
  db?: SQLiteClient;
  now?: () => string;
}

interface CatalogModelRow {
  model_key: LlmModelKey;
  display_name: string;
  hf_repo_id: string;
  hf_filename: string;
  mmproj_filename: string | null;
  backend: 'server';
  model_family: 'instruct/think';
}

interface DownloadedModelRow {
  model_key: LlmModelKey;
  display_name: string;
  local_gguf_path: string;
  local_mmproj_path: string | null;
  downloaded_at: string;
  is_active: number;
}

interface SelectableModelRow {
  model_key: LlmModelKey;
  display_name: string;
  local_gguf_path: string;
  local_mmproj_path: string | null;
  downloaded_at: string;
}

interface DownloadedModelByKeyRow {
  model_key: LlmModelKey;
  display_name: string;
  local_gguf_path: string;
  local_mmproj_path: string | null;
  downloaded_at: string;
  is_active: number;
}

export class LlmSelectionRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;
  private readonly settingsRepository: LlmSettingsRepository;

  constructor(options: LlmSelectionRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
    this.settingsRepository = new LlmSettingsRepository(this.db);
  }

  async listCatalogModels(): Promise<CatalogLlmModelDto[]> {
    const rows = await this.db.all<CatalogModelRow>(
      `SELECT model_key, display_name, hf_repo_id, hf_filename, mmproj_filename, backend, model_family
       FROM llm_selection_defaults
       ORDER BY display_name COLLATE NOCASE ASC, model_key ASC;`
    );
    return rows.map((row) => ({
      key: row.model_key,
      displayName: row.display_name,
      hfRepoId: row.hf_repo_id,
      hfFilename: row.hf_filename,
      mmprojFilename: row.mmproj_filename,
      backend: row.backend,
      modelFamily: row.model_family
    }));
  }

  async listDownloadedModels(): Promise<DownloadedLlmModelDto[]> {
    const rows = await this.db.all<DownloadedModelRow>(
      `SELECT model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active
       FROM llm_selection
       ORDER BY is_active DESC, downloaded_at DESC, model_key ASC;`
    );
    return rows.map((row) => this.mapDownloadedModel(row));
  }

  async getActiveModel(): Promise<DownloadedLlmModelDto | null> {
    const row = await this.db.get<DownloadedModelRow>(
      `SELECT model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active
       FROM llm_selection
       WHERE is_active = 1
       LIMIT 1;`
    );
    return row ? this.mapDownloadedModel(row) : null;
  }

  async upsertDownloadedModel(model: {
    key: LlmModelKey;
    displayName: string;
    localGgufPath: string;
    localMmprojPath?: string | null;
  }): Promise<DownloadedLlmModelDto> {
    const downloadedAt = this.now();
    await this.db.run(
      `INSERT INTO llm_selection (model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active)
       VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(model_key)
       DO UPDATE SET
         display_name = excluded.display_name,
         local_gguf_path = excluded.local_gguf_path,
         local_mmproj_path = excluded.local_mmproj_path,
         downloaded_at = excluded.downloaded_at;`,
      [model.key, model.displayName, model.localGgufPath, model.localMmprojPath ?? null, downloadedAt]
    );

    const row = await this.db.get<DownloadedModelRow>(
      `SELECT model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active
       FROM llm_selection
       WHERE model_key = ?
       LIMIT 1;`,
      [model.key]
    );
    if (!row) {
      throw new Error(`Downloaded model was not persisted: ${model.key}`);
    }
    return this.mapDownloadedModel(row);
  }

  async getDownloadedModelByKey(modelKey: LlmModelKey): Promise<DownloadedLlmModelDto | null> {
    const row = await this.db.get<DownloadedModelByKeyRow>(
      `SELECT model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active
       FROM llm_selection
       WHERE model_key = ?
       LIMIT 1;`,
      [modelKey]
    );
    return row ? this.mapDownloadedModel(row) : null;
  }

  async deleteDownloadedModel(modelKey: LlmModelKey): Promise<DownloadedLlmModelDto | null> {
    const existing = await this.getDownloadedModelByKey(modelKey);
    if (!existing) {
      return null;
    }

    await this.db.run(`DELETE FROM llm_selection WHERE model_key = ?;`, [modelKey]);
    return existing;
  }

  async selectModel(
    modelKey: LlmModelKey,
    llmServerPath?: string
  ): Promise<{ activeModel: DownloadedLlmModelDto; settings: LlmRuntimeSettings } | null> {
    await this.db.exec('BEGIN;');
    try {
      const modelRow = await this.db.get<SelectableModelRow>(
        `SELECT s.model_key, s.display_name, s.local_gguf_path, s.local_mmproj_path, s.downloaded_at
         FROM llm_selection s
         INNER JOIN llm_selection_defaults d ON d.model_key = s.model_key
         WHERE s.model_key = ?
         LIMIT 1;`,
        [modelKey]
      );

      if (!modelRow) {
        await this.db.exec('ROLLBACK;');
        return null;
      }

      await this.db.run('UPDATE llm_selection SET is_active = CASE WHEN model_key = ? THEN 1 ELSE 0 END;', [modelKey]);
      await this.applyDefaultsToRuntimeSettings(modelKey, modelRow.local_gguf_path, modelRow.local_mmproj_path, llmServerPath);
      await this.db.exec('COMMIT;');

      const settings = await this.settingsRepository.getRuntimeSettings();
      return {
        activeModel: {
          key: modelRow.model_key,
          displayName: modelRow.display_name,
          localGgufPath: modelRow.local_gguf_path,
          localMmprojPath: modelRow.local_mmproj_path,
          downloadedAt: modelRow.downloaded_at,
          isActive: true
        },
        settings
      };
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async resetSettingsToDefaults(
    llmServerPath?: string
  ): Promise<{ activeModel: DownloadedLlmModelDto; settings: LlmRuntimeSettings } | null> {
    const active = await this.db.get<DownloadedModelRow>(
      `SELECT model_key, display_name, local_gguf_path, local_mmproj_path, downloaded_at, is_active
       FROM llm_selection
       WHERE is_active = 1
       LIMIT 1;`
    );
    if (!active) {
      return null;
    }

    await this.db.exec('BEGIN;');
    try {
      await this.applyDefaultsToRuntimeSettings(active.model_key, active.local_gguf_path, active.local_mmproj_path, llmServerPath);
      await this.db.exec('COMMIT;');
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }

    return {
      activeModel: this.mapDownloadedModel(active),
      settings: await this.settingsRepository.getRuntimeSettings()
    };
  }

  private async applyDefaultsToRuntimeSettings(
    modelKey: LlmModelKey,
    ggufPath: string,
    mmprojPath: string | null,
    llmServerPath?: string
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO llm_settings (
         id,
         llm_server_path,
         llm_gguf_path,
         llm_mmproj_path,
         llm_server_url,
         llm_host,
         llm_port,
         llm_n_ctx,
         llm_n_threads,
         llm_n_gpu_layers,
         llm_n_batch,
         llm_n_parallel,
         llm_seed,
         llm_rope_freq_base,
         llm_rope_freq_scale,
         llm_use_jinja,
         llm_cache_prompt,
         llm_flash_attn,
         max_tokens,
         temperature,
         top_p,
         top_k,
         repeat_penalty,
         request_seed,
         use_fake_reply,
         fake_reply_text
       )
       SELECT
         'default',
         d.llm_server_path,
         d.llm_gguf_path,
         d.llm_mmproj_path,
         d.llm_server_url,
         d.llm_host,
         d.llm_port,
         d.llm_n_ctx,
         d.llm_n_threads,
         d.llm_n_gpu_layers,
         d.llm_n_batch,
         d.llm_n_parallel,
         d.llm_seed,
         d.llm_rope_freq_base,
         d.llm_rope_freq_scale,
         d.llm_use_jinja,
         d.llm_cache_prompt,
         d.llm_flash_attn,
         d.max_tokens,
         d.temperature,
         d.top_p,
         d.top_k,
         d.repeat_penalty,
         d.request_seed,
         d.use_fake_reply,
         d.fake_reply_text
       FROM llm_selection_defaults d
       WHERE d.model_key = ?
       ON CONFLICT(id) DO UPDATE SET
         llm_server_path = excluded.llm_server_path,
         llm_gguf_path = excluded.llm_gguf_path,
         llm_mmproj_path = excluded.llm_mmproj_path,
         llm_server_url = excluded.llm_server_url,
         llm_host = excluded.llm_host,
         llm_port = excluded.llm_port,
         llm_n_ctx = excluded.llm_n_ctx,
         llm_n_threads = excluded.llm_n_threads,
         llm_n_gpu_layers = excluded.llm_n_gpu_layers,
         llm_n_batch = excluded.llm_n_batch,
         llm_n_parallel = excluded.llm_n_parallel,
         llm_seed = excluded.llm_seed,
         llm_rope_freq_base = excluded.llm_rope_freq_base,
         llm_rope_freq_scale = excluded.llm_rope_freq_scale,
         llm_use_jinja = excluded.llm_use_jinja,
         llm_cache_prompt = excluded.llm_cache_prompt,
         llm_flash_attn = excluded.llm_flash_attn,
         max_tokens = excluded.max_tokens,
         temperature = excluded.temperature,
         top_p = excluded.top_p,
         top_k = excluded.top_k,
         repeat_penalty = excluded.repeat_penalty,
         request_seed = excluded.request_seed,
         use_fake_reply = excluded.use_fake_reply,
         fake_reply_text = excluded.fake_reply_text;`,
      [modelKey]
    );

    await this.db.run(
      `UPDATE llm_settings
       SET llm_server_path = COALESCE(?, llm_server_path),
           llm_gguf_path = ?,
           llm_mmproj_path = ?,
           use_fake_reply = 0,
           fake_reply_text = NULL
       WHERE id = 'default';`,
      [llmServerPath ?? null, ggufPath, mmprojPath]
    );
  }

  private mapDownloadedModel(row: DownloadedModelRow): DownloadedLlmModelDto {
    return {
      key: row.model_key,
      displayName: row.display_name,
      localGgufPath: row.local_gguf_path,
      localMmprojPath: row.local_mmproj_path,
      downloadedAt: row.downloaded_at,
      isActive: row.is_active === 1
    };
  }
}
