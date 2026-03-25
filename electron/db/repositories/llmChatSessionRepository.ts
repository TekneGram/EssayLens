import { randomUUID } from 'node:crypto';
import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';

export interface LlmSessionTurn {
  role: 'teacher' | 'assistant' | 'system';
  content: string;
}

export interface LlmSessionListItem {
  sessionId: string;
  fileEntityUuid: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

interface LlmChatSessionRepositoryOptions {
  db?: SQLiteClient;
  now?: () => string;
  maxTurns?: number;
}

interface TurnRow {
  role: 'teacher' | 'assistant' | 'system';
  content: string;
  seq: number;
}

interface SessionRow {
  session_id: string;
  file_entity_uuid: string;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

const DEFAULT_PIPELINE_KEY = 'simple-chat';

export class LlmChatSessionRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;
  private readonly maxTurns: number;

  constructor(options: LlmChatSessionRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
    this.maxTurns = Math.max(options.maxTurns ?? 12, 1);
  }

  async createSession(sessionId: string, fileEntityUuid: string): Promise<{ sessionId: string; fileEntityUuid: string }> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const normalizedFileEntityUuid = this.normalizeFileEntityUuid(fileEntityUuid);
    const nowIso = this.now();
    await this.assertSessionFileAssociation(normalizedSessionId, normalizedFileEntityUuid);
    await this.db.run(
      `INSERT INTO llm_chat_sessions (session_id, file_entity_uuid, pipeline_key, created_at, updated_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id) DO UPDATE SET
         file_entity_uuid = COALESCE(llm_chat_sessions.file_entity_uuid, excluded.file_entity_uuid),
         updated_at = excluded.updated_at,
         last_used_at = excluded.last_used_at;`,
      [normalizedSessionId, normalizedFileEntityUuid, DEFAULT_PIPELINE_KEY, nowIso, nowIso, nowIso]
    );
    return { sessionId: normalizedSessionId, fileEntityUuid: normalizedFileEntityUuid };
  }

  async clearSession(sessionId: string): Promise<{ sessionId: string; cleared: boolean }> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    await this.db.exec('BEGIN;');
    try {
      const turnsDeleted = await this.db.run(
        'DELETE FROM llm_chat_session_turns WHERE session_id = ?;',
        [normalizedSessionId]
      );
      const sessionsUpdated = await this.db.run(
        `UPDATE llm_chat_sessions
         SET updated_at = ?, last_used_at = ?
         WHERE session_id = ?;`,
        [this.now(), this.now(), normalizedSessionId]
      );
      await this.db.exec('COMMIT;');
      return {
        sessionId: normalizedSessionId,
        cleared: turnsDeleted.changes > 0 || sessionsUpdated.changes > 0
      };
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<{ sessionId: string; deleted: boolean }> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const result = await this.db.run('DELETE FROM llm_chat_sessions WHERE session_id = ?;', [normalizedSessionId]);
    return {
      sessionId: normalizedSessionId,
      deleted: result.changes > 0
    };
  }

  async listRecentTurns(sessionId: string, fileEntityUuid?: string): Promise<LlmSessionTurn[]> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const maxEntries = this.maxTurns * 2;
    const rows =
      typeof fileEntityUuid === 'string' && fileEntityUuid.trim()
        ? await this.db.all<TurnRow>(
            `SELECT t.role, t.content, t.seq
             FROM llm_chat_session_turns t
             INNER JOIN llm_chat_sessions s ON s.session_id = t.session_id
             WHERE t.session_id = ? AND s.file_entity_uuid = ?
             ORDER BY t.seq DESC
             LIMIT ?;`,
            [normalizedSessionId, this.normalizeFileEntityUuid(fileEntityUuid), maxEntries]
          )
        : await this.db.all<TurnRow>(
            `SELECT role, content, seq
             FROM llm_chat_session_turns
             WHERE session_id = ?
             ORDER BY seq DESC
             LIMIT ?;`,
            [normalizedSessionId, maxEntries]
          );
    return rows
      .reverse()
      .map((row) => ({
        role: row.role,
        content: row.content
      }));
  }

  async appendTurnPair(sessionId: string, teacherMessage: string, assistantReply: string, fileId?: string): Promise<void> {
    const normalizedSessionId = this.normalizeSessionId(sessionId);
    const trimmedTeacher = teacherMessage.trim();
    const trimmedAssistant = assistantReply.trim();
    if (!trimmedTeacher) {
      throw new Error('Teacher message cannot be empty.');
    }
    if (!trimmedAssistant) {
      throw new Error('Assistant reply cannot be empty.');
    }

    const nowIso = this.now();
    const normalizedFileEntityUuid =
      typeof fileId === 'string' && fileId.trim() ? this.normalizeFileEntityUuid(fileId) : null;
    if (normalizedFileEntityUuid) {
      await this.assertSessionFileAssociation(normalizedSessionId, normalizedFileEntityUuid);
    }
    await this.db.exec('BEGIN;');
    try {
      await this.db.run(
        `INSERT INTO llm_chat_sessions (session_id, file_entity_uuid, pipeline_key, created_at, updated_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(session_id) DO UPDATE SET
           file_entity_uuid = COALESCE(llm_chat_sessions.file_entity_uuid, excluded.file_entity_uuid),
           updated_at = excluded.updated_at,
           last_used_at = excluded.last_used_at;`,
        [normalizedSessionId, normalizedFileEntityUuid, DEFAULT_PIPELINE_KEY, nowIso, nowIso, nowIso]
      );

      const current = await this.db.get<{ max_seq: number | null }>(
        'SELECT MAX(seq) AS max_seq FROM llm_chat_session_turns WHERE session_id = ?;',
        [normalizedSessionId]
      );
      const startSeq = (current?.max_seq ?? 0) + 1;

      await this.db.run(
        `INSERT INTO llm_chat_session_turns (uuid, session_id, seq, role, content, created_at)
         VALUES (?, ?, ?, 'teacher', ?, ?);`,
        [randomUUID(), normalizedSessionId, startSeq, trimmedTeacher, nowIso]
      );
      await this.db.run(
        `INSERT INTO llm_chat_session_turns (uuid, session_id, seq, role, content, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?);`,
        [randomUUID(), normalizedSessionId, startSeq + 1, trimmedAssistant, nowIso]
      );

      const maxEntries = this.maxTurns * 2;
      await this.db.run(
        `DELETE FROM llm_chat_session_turns
         WHERE session_id = ?
           AND seq <= (
             SELECT COALESCE(MAX(seq), 0) - ?
             FROM llm_chat_session_turns
             WHERE session_id = ?
           );`,
        [normalizedSessionId, maxEntries, normalizedSessionId]
      );

      await this.db.exec('COMMIT;');
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async listSessionsByFile(fileEntityUuid: string): Promise<LlmSessionListItem[]> {
    const normalizedFileEntityUuid = this.normalizeFileEntityUuid(fileEntityUuid);
    const rows = await this.db.all<SessionRow>(
      `SELECT session_id, file_entity_uuid, created_at, updated_at, last_used_at
       FROM llm_chat_sessions
       WHERE file_entity_uuid = ?
       ORDER BY last_used_at DESC, created_at DESC, session_id ASC;`,
      [normalizedFileEntityUuid]
    );
    return rows.map((row) => ({
      sessionId: row.session_id,
      fileEntityUuid: row.file_entity_uuid,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastUsedAt: row.last_used_at
    }));
  }

  private normalizeSessionId(sessionId: string): string {
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      throw new Error('Session id must be a non-empty string.');
    }
    return sessionId.trim();
  }

  private normalizeFileEntityUuid(fileEntityUuid: string): string {
    if (typeof fileEntityUuid !== 'string' || !fileEntityUuid.trim()) {
      throw new Error('fileEntityUuid must be a non-empty string.');
    }
    return fileEntityUuid.trim();
  }

  private async assertSessionFileAssociation(sessionId: string, fileEntityUuid: string): Promise<void> {
    const existing = await this.db.get<{ file_entity_uuid: string | null }>(
      `SELECT file_entity_uuid
       FROM llm_chat_sessions
       WHERE session_id = ?
       LIMIT 1;`,
      [sessionId]
    );
    if (!existing || existing.file_entity_uuid === null) {
      return;
    }
    if (existing.file_entity_uuid !== fileEntityUuid) {
      throw new Error('Session is already associated with a different file entity uuid.');
    }
  }
}
