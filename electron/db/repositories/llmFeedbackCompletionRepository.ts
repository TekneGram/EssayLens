import { randomUUID } from 'node:crypto';
import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';

export type LlmFeedbackWorkflowKey = 'paragraph_feedback';

export interface LlmFeedbackCompletionRecord {
  id: string;
  fileId: string;
  workflowKey: LlmFeedbackWorkflowKey;
  modelKey: string;
  modelDisplayName: string;
  sessionId: string;
  completedAt: string;
}

interface CompletionRow {
  uuid: string;
  file_entity_uuid: string;
  workflow_key: LlmFeedbackWorkflowKey;
  model_key: string;
  model_display_name: string;
  session_id: string;
  completed_at: string;
}

interface LlmFeedbackCompletionRepositoryOptions {
  db?: SQLiteClient;
  now?: () => string;
}

export class LlmFeedbackCompletionRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: LlmFeedbackCompletionRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listCompletedForFiles(args: {
    fileIds: string[];
    workflowKey: LlmFeedbackWorkflowKey;
    modelKey: string;
  }): Promise<LlmFeedbackCompletionRecord[]> {
    const fileIds = [...new Set(args.fileIds.map((fileId) => fileId.trim()).filter(Boolean))];
    if (fileIds.length === 0) {
      return [];
    }

    const placeholders = fileIds.map(() => '?').join(', ');
    const rows = await this.db.all<CompletionRow>(
      `SELECT uuid, file_entity_uuid, workflow_key, model_key, model_display_name, session_id, completed_at
       FROM llm_feedback_completions
       WHERE workflow_key = ?
         AND model_key = ?
         AND file_entity_uuid IN (${placeholders})
       ORDER BY completed_at DESC, uuid ASC;`,
      [args.workflowKey, args.modelKey, ...fileIds]
    );

    const latestByFile = new Map<string, LlmFeedbackCompletionRecord>();
    for (const row of rows) {
      if (!latestByFile.has(row.file_entity_uuid)) {
        latestByFile.set(row.file_entity_uuid, this.mapRow(row));
      }
    }
    return fileIds.flatMap((fileId) => {
      const record = latestByFile.get(fileId);
      return record ? [record] : [];
    });
  }

  async addCompletion(args: {
    fileId: string;
    workflowKey: LlmFeedbackWorkflowKey;
    modelKey: string;
    modelDisplayName: string;
    sessionId: string;
  }): Promise<LlmFeedbackCompletionRecord> {
    const id = randomUUID();
    const completedAt = this.now();
    await this.db.run(
      `INSERT INTO llm_feedback_completions
       (uuid, file_entity_uuid, workflow_key, model_key, model_display_name, session_id, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [id, args.fileId, args.workflowKey, args.modelKey, args.modelDisplayName, args.sessionId, completedAt]
    );

    return {
      id,
      fileId: args.fileId,
      workflowKey: args.workflowKey,
      modelKey: args.modelKey,
      modelDisplayName: args.modelDisplayName,
      sessionId: args.sessionId,
      completedAt
    };
  }

  private mapRow(row: CompletionRow): LlmFeedbackCompletionRecord {
    return {
      id: row.uuid,
      fileId: row.file_entity_uuid,
      workflowKey: row.workflow_key,
      modelKey: row.model_key,
      modelDisplayName: row.model_display_name,
      sessionId: row.session_id,
      completedAt: row.completed_at
    };
  }
}
