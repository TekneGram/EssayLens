import { randomUUID } from 'node:crypto';
import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';

export interface EssayFeedbackBodyParagraph {
  body_paragraph: string;
}

export interface EssayFeedbackIdentifiedParagraphs {
  introductionParagraph: string;
  bodyParagraphs: EssayFeedbackBodyParagraph[];
  conclusionParagraph: string;
  thesisStatement?: string | null;
  mainIdea?: string | null;
}

interface EssayFeedbackAnalysisRepositoryOptions {
  db?: SQLiteClient;
  now?: () => string;
}

interface AnalysisRow {
  introduction_paragraph: string;
  body_paragraphs_json: string;
  conclusion_paragraph: string;
  thesis_statement: string | null;
  main_idea: string | null;
}

export class EssayFeedbackAnalysisRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: EssayFeedbackAnalysisRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async upsertIdentifiedParagraphs(
    sessionId: string,
    fileId: string,
    paragraphs: EssayFeedbackIdentifiedParagraphs
  ): Promise<void> {
    const normalizedSessionId = sessionId.trim();
    const normalizedFileId = fileId.trim();
    const nowIso = this.now();
    await this.db.run(
      `INSERT INTO essay_feedback_analyses
       (uuid, session_id, file_entity_uuid, introduction_paragraph, body_paragraphs_json, conclusion_paragraph, thesis_statement, main_idea, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, file_entity_uuid) DO UPDATE SET
         introduction_paragraph = excluded.introduction_paragraph,
         body_paragraphs_json = excluded.body_paragraphs_json,
         conclusion_paragraph = excluded.conclusion_paragraph,
         thesis_statement = COALESCE(excluded.thesis_statement, essay_feedback_analyses.thesis_statement),
         main_idea = COALESCE(excluded.main_idea, essay_feedback_analyses.main_idea),
         updated_at = excluded.updated_at;`,
      [
        randomUUID(),
        normalizedSessionId,
        normalizedFileId,
        paragraphs.introductionParagraph,
        JSON.stringify(paragraphs.bodyParagraphs),
        paragraphs.conclusionParagraph,
        paragraphs.thesisStatement ?? null,
        paragraphs.mainIdea ?? null,
        nowIso,
        nowIso
      ]
    );
  }

  async saveThesisStatement(sessionId: string, fileId: string, thesisStatement: string): Promise<void> {
    const normalizedSessionId = sessionId.trim();
    const normalizedFileId = fileId.trim();
    const normalizedThesisStatement = thesisStatement.trim();
    if (!normalizedThesisStatement) {
      throw new Error('thesisStatement must be a non-empty string.');
    }
    await this.db.run(
      `UPDATE essay_feedback_analyses
       SET thesis_statement = ?, updated_at = ?
       WHERE session_id = ? AND file_entity_uuid = ?;`,
      [normalizedThesisStatement, this.now(), normalizedSessionId, normalizedFileId]
    );
  }

  async saveMainIdea(sessionId: string, fileId: string, mainIdea: string): Promise<void> {
    const normalizedSessionId = sessionId.trim();
    const normalizedFileId = fileId.trim();
    const normalizedMainIdea = mainIdea.trim();
    if (!normalizedMainIdea) {
      throw new Error('mainIdea must be a non-empty string.');
    }
    await this.db.run(
      `UPDATE essay_feedback_analyses
       SET main_idea = ?, updated_at = ?
       WHERE session_id = ? AND file_entity_uuid = ?;`,
      [normalizedMainIdea, this.now(), normalizedSessionId, normalizedFileId]
    );
  }

  async getIdentifiedParagraphs(
    sessionId: string,
    fileId: string
  ): Promise<EssayFeedbackIdentifiedParagraphs | null> {
    const row = await this.db.get<AnalysisRow>(
      `SELECT introduction_paragraph, body_paragraphs_json, conclusion_paragraph, thesis_statement, main_idea
       FROM essay_feedback_analyses
       WHERE session_id = ? AND file_entity_uuid = ?
       LIMIT 1;`,
      [sessionId.trim(), fileId.trim()]
    );
    if (!row) {
      return null;
    }

    const parsedBodyParagraphs = this.parseBodyParagraphs(row.body_paragraphs_json);
    return {
      introductionParagraph: row.introduction_paragraph,
      bodyParagraphs: parsedBodyParagraphs,
      conclusionParagraph: row.conclusion_paragraph,
      thesisStatement: typeof row.thesis_statement === 'string' ? row.thesis_statement : null,
      mainIdea: typeof row.main_idea === 'string' ? row.main_idea : null
    };
  }

  private parseBodyParagraphs(raw: string): EssayFeedbackBodyParagraph[] {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.flatMap((item) => {
        if (
          typeof item === 'object' &&
          item !== null &&
          typeof (item as { body_paragraph?: unknown }).body_paragraph === 'string'
        ) {
          return [{ body_paragraph: (item as { body_paragraph: string }).body_paragraph }];
        }
        return [];
      });
    } catch {
      return [];
    }
  }
}
