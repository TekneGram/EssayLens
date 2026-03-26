import type { LlmSettings } from './llmManager.types';

export type SettingKey = keyof LlmSettings;
export type EditableValue = string | number | boolean | null;

const BOOLEAN_KEYS: ReadonlySet<SettingKey> = new Set(['llm_use_jinja', 'llm_cache_prompt', 'llm_flash_attn', 'use_fake_reply']);

const NUMBER_KEYS: ReadonlySet<SettingKey> = new Set(['llm_port', 'llm_n_ctx', 'max_tokens', 'temperature']);

const NULLABLE_NUMBER_KEYS: ReadonlySet<SettingKey> = new Set([
  'llm_n_threads',
  'llm_n_gpu_layers',
  'llm_n_batch',
  'llm_n_parallel',
  'llm_seed',
  'llm_rope_freq_base',
  'llm_rope_freq_scale',
  'top_p',
  'top_k',
  'repeat_penalty',
  'request_seed'
]);

const NULLABLE_STRING_KEYS: ReadonlySet<SettingKey> = new Set(['llm_gguf_path', 'llm_mmproj_path', 'fake_reply_text']);

const EDITABLE_KEYS: ReadonlySet<SettingKey> = new Set([
  'fake_reply_text',
  'llm_n_batch',
  'llm_n_ctx',
  'llm_n_gpu_layers',
  'llm_n_threads',
  'max_tokens',
  'repeat_penalty',
  'temperature',
  'top_k',
  'top_p',
  'use_fake_reply'
]);

export function isBooleanSettingKey(key: SettingKey): boolean {
  return BOOLEAN_KEYS.has(key);
}

export function isEditableSettingKey(key: SettingKey): boolean {
  return EDITABLE_KEYS.has(key);
}

export function formatSettingValue(value: EditableValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  return String(value);
}

export function parseSettingStringValue(key: SettingKey, rawValue: string): EditableValue {
  if (NUMBER_KEYS.has(key)) {
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Value for ${key} must be a number.`);
    }
    return parsed;
  }

  if (NULLABLE_NUMBER_KEYS.has(key)) {
    if (!rawValue.trim()) {
      return null;
    }
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Value for ${key} must be a number or empty.`);
    }
    return parsed;
  }

  if (NULLABLE_STRING_KEYS.has(key)) {
    return rawValue.trim() ? rawValue : null;
  }

  return rawValue;
}
