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
}

interface EssayFeedbackAnalysisRepositoryOptions {
  db?: SQLiteClient;
  now?: () => string;
}

interface AnalysisRow {
  introduction_paragraph: string;
  body_paragraphs_json: string;
  conclusion_paragraph: string;
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
       (uuid, session_id, file_entity_uuid, introduction_paragraph, body_paragraphs_json, conclusion_paragraph, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(session_id, file_entity_uuid) DO UPDATE SET
         introduction_paragraph = excluded.introduction_paragraph,
         body_paragraphs_json = excluded.body_paragraphs_json,
         conclusion_paragraph = excluded.conclusion_paragraph,
         updated_at = excluded.updated_at;`,
      [
        randomUUID(),
        normalizedSessionId,
        normalizedFileId,
        paragraphs.introductionParagraph,
        JSON.stringify(paragraphs.bodyParagraphs),
        paragraphs.conclusionParagraph,
        nowIso,
        nowIso
      ]
    );
  }

  async getIdentifiedParagraphs(
    sessionId: string,
    fileId: string
  ): Promise<EssayFeedbackIdentifiedParagraphs | null> {
    const row = await this.db.get<AnalysisRow>(
      `SELECT introduction_paragraph, body_paragraphs_json, conclusion_paragraph
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
      conclusionParagraph: row.conclusion_paragraph
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
