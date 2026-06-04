import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LlmSelectionRepository } from './llmSelectionRepository';
import { SQLiteClient } from '../sqlite';

const createdDbs: SQLiteClient[] = [];

async function createRepository() {
  const db = new SQLiteClient({
    dbPath: ':memory:',
    migrationsDir: path.resolve(process.cwd(), 'electron/db/migrations')
  });
  createdDbs.push(db);
  const repository = new LlmSelectionRepository({ db });

  await repository.upsertDownloadedModel({
    key: 'gemma4_e4b_it_q4_k_m',
    displayName: 'Gemma 4 E4B Instruct Q4_K_M',
    localGgufPath: '/models/gemma.gguf'
  });
  await repository.upsertDownloadedModel({
    key: 'qwen3_4b_q8',
    displayName: 'Qwen3 4B Q8_0',
    localGgufPath: '/models/qwen.gguf'
  });

  return { repository, db };
}

afterEach(async () => {
  while (createdDbs.length > 0) {
    const db = createdDbs.pop();
    if (db) {
      await db.close();
    }
  }
});

describe('LlmSelectionRepository.selectModel', () => {
  it('applies Gemma reasoning defaults and instruct/think family when Gemma is selected', async () => {
    const { repository } = await createRepository();

    const selected = await repository.selectModel('gemma4_e4b_it_q4_k_m', '/bin/llama-server', '/assets/gemma.jinja');

    expect(selected?.activeModel.key).toBe('gemma4_e4b_it_q4_k_m');
    expect(selected?.settings.llm_model_family).toBe('instruct/think');
    expect(selected?.settings.llm_message_format).toBe('gemma');
    expect(selected?.settings.llm_reasoning_mode).toBe('off');
    expect(selected?.settings.llm_reasoning_budget).toBe(0);
    expect(selected?.settings.llm_chat_template_path).toBe('/assets/gemma.jinja');
  });

  it('switches the active model without violating the single-active unique index', async () => {
    const { repository } = await createRepository();

    const initial = await repository.selectModel('gemma4_e4b_it_q4_k_m', '/bin/llama-server', '/assets/gemma.jinja');
    expect(initial?.activeModel.key).toBe('gemma4_e4b_it_q4_k_m');

    const switched = await repository.selectModel('qwen3_4b_q8', '/bin/llama-server', null);

    expect(switched?.activeModel.key).toBe('qwen3_4b_q8');
    expect(switched?.settings.llm_gguf_path).toBe('/models/qwen.gguf');
    expect(switched?.settings.llm_model_family).toBe('instruct/think');
    expect(switched?.settings.llm_message_format).toBe('openai');
    expect(switched?.settings.llm_reasoning_mode).toBeNull();
    expect(switched?.settings.llm_reasoning_budget).toBeNull();
    expect(switched?.settings.llm_chat_template_path).toBeNull();

    const active = await repository.getActiveModel();
    expect(active?.key).toBe('qwen3_4b_q8');

    const downloaded = await repository.listDownloadedModels();
    expect(downloaded.find((model) => model.key === 'qwen3_4b_q8')?.isActive).toBe(true);
    expect(downloaded.find((model) => model.key === 'gemma4_e4b_it_q4_k_m')?.isActive).toBe(false);
  });
});
