import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';
import { ensureFileRecord } from './sqlHelpers';

export interface FeedbackRecord {
  id: string;
  fileId: string;
  kind: 'inline' | 'block';
  source: 'teacher' | 'llm';
  commentText: string;
  applied?: boolean;
  createdAt?: string;
  updatedAt?: string;
  exactQuote?: string;
  prefixText?: string;
  suffixText?: string;
  startAnchor?: {
    part: string;
    paragraphIndex: number;
    runIndex: number;
    charOffset: number;
  };
  endAnchor?: {
    part: string;
    paragraphIndex: number;
    runIndex: number;
    charOffset: number;
  };
}

interface FeedbackRow {
  uuid: string;
  entity_uuid: string;
  kind: 'inline' | 'block';
  source: 'teacher' | 'llm';
  comment_text: string;
  exact_quote: string | null;
  prefix_text: string | null;
  suffix_text: string | null;
  applied: 0 | 1;
  created_at: string;
  updated_at: string | null;
}

type AnchorKind = 'start' | 'end';

interface FeedbackAnchorRow {
  feedback_uuid: string;
  anchor_kind: AnchorKind;
  part: string;
  paragraph_index: number;
  run_index: number;
  text_node_index: number;
  char_offset: number;
}

interface FeedbackRepositoryOptions {
  now?: () => string;
  db?: SQLiteClient;
}

export class FeedbackRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: FeedbackRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listByFileId(fileId: string): Promise<FeedbackRecord[]> {
    const rows = await this.db.all<FeedbackRow>(
      `SELECT uuid, entity_uuid, kind, source, comment_text, exact_quote, prefix_text, suffix_text, applied, created_at, updated_at
       FROM feedback
       WHERE entity_uuid = ?
       ORDER BY created_at ASC, uuid ASC;`,
      [fileId]
    );

    if (rows.length === 0) {
      return [];
    }

    const feedbackIds = rows.map((row) => row.uuid);
    const placeholders = feedbackIds.map(() => '?').join(', ');
    const anchors = await this.db.all<FeedbackAnchorRow>(
      `SELECT feedback_uuid, anchor_kind, part, paragraph_index, run_index, text_node_index, char_offset
       FROM feedback_anchors
       WHERE feedback_uuid IN (${placeholders})
       ORDER BY feedback_uuid ASC, anchor_kind ASC;`,
      feedbackIds
    );

    const anchorsByFeedbackId = new Map<string, Map<AnchorKind, FeedbackAnchorRow>>();
    for (const anchor of anchors) {
      const entry = anchorsByFeedbackId.get(anchor.feedback_uuid) ?? new Map<AnchorKind, FeedbackAnchorRow>();
      entry.set(anchor.anchor_kind, anchor);
      anchorsByFeedbackId.set(anchor.feedback_uuid, entry);
    }

    return rows.map((row) => this.mapRowToRecord(row, anchorsByFeedbackId.get(row.uuid)));
  }

  async getById(feedbackId: string): Promise<FeedbackRecord | null> {
    const row = await this.db.get<FeedbackRow>(
      `SELECT uuid, entity_uuid, kind, source, comment_text, exact_quote, prefix_text, suffix_text, applied, created_at, updated_at
       FROM feedback
       WHERE uuid = ?;`,
      [feedbackId]
    );

    if (!row) {
      return null;
    }

    const anchors = await this.db.all<FeedbackAnchorRow>(
      `SELECT feedback_uuid, anchor_kind, part, paragraph_index, run_index, text_node_index, char_offset
       FROM feedback_anchors
       WHERE feedback_uuid = ?;`,
      [feedbackId]
    );

    const anchorMap = new Map<AnchorKind, FeedbackAnchorRow>();
    for (const anchor of anchors) {
      anchorMap.set(anchor.anchor_kind, anchor);
    }

    return this.mapRowToRecord(row, anchorMap);
  }

  async add(feedback: FeedbackRecord): Promise<FeedbackRecord> {
    const createdAt = feedback.createdAt ?? this.now();
    const updatedAt = feedback.updatedAt ?? null;
    const appliedValue = feedback.applied === true ? 1 : 0;

    if (!feedback.id.trim()) {
      throw new Error('Feedback id is required.');
    }
    if (!feedback.fileId.trim()) {
      throw new Error('Feedback fileId is required.');
    }
    if (!feedback.commentText.trim()) {
      throw new Error('Feedback commentText is required.');
    }

    const isInline = feedback.kind === 'inline';
    if (!isInline) {
      if (feedback.exactQuote || feedback.prefixText || feedback.suffixText || feedback.startAnchor || feedback.endAnchor) {
        throw new Error('Block feedback cannot include inline quote or anchor fields.');
      }
    } else {
      if (!feedback.exactQuote || feedback.exactQuote.trim().length === 0) {
        throw new Error('Inline feedback requires exactQuote.');
      }
      if (feedback.prefixText === undefined || feedback.suffixText === undefined) {
        throw new Error('Inline feedback requires prefixText and suffixText.');
      }
      if (!feedback.startAnchor || !feedback.endAnchor) {
        throw new Error('Inline feedback requires both startAnchor and endAnchor.');
      }
    }

    await this.db.exec('BEGIN;');
    try {
      await ensureFileRecord(this.db, feedback.fileId, createdAt);
      await this.db.run(
        `INSERT INTO feedback
         (uuid, entity_uuid, kind, source, comment_text, exact_quote, prefix_text, suffix_text, applied, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          feedback.id,
          feedback.fileId,
          feedback.kind,
          feedback.source,
          feedback.commentText,
          feedback.exactQuote ?? null,
          feedback.prefixText ?? null,
          feedback.suffixText ?? null,
          appliedValue,
          createdAt,
          updatedAt
        ]
      );

      if (isInline) {
        this.assertAnchor(feedback.startAnchor!, 'start');
        this.assertAnchor(feedback.endAnchor!, 'end');

        await this.insertAnchor(feedback.id, 'start', feedback.startAnchor!);
        await this.insertAnchor(feedback.id, 'end', feedback.endAnchor!);
      }

      await this.db.exec('COMMIT;');
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }

    const created = await this.getById(feedback.id);
    if (!created) {
      throw new Error(`Created feedback could not be loaded: ${feedback.id}`);
    }
    return created;
  }

  async editCommentText(feedbackId: string, commentText: string): Promise<FeedbackRecord | null> {
    const trimmedText = commentText.trim();
    if (!trimmedText) {
      throw new Error('Feedback commentText is required.');
    }

    const updatedAt = this.now();
    const result = await this.db.run(
      `UPDATE feedback
       SET comment_text = ?, updated_at = ?
       WHERE uuid = ?;`,
      [trimmedText, updatedAt, feedbackId]
    );
    if (result.changes === 0) {
      return null;
    }

    return await this.getById(feedbackId);
  }

  async deleteById(feedbackId: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM feedback WHERE uuid = ?;', [feedbackId]);
    return result.changes > 0;
  }

  async setApplied(feedbackId: string, applied: boolean): Promise<FeedbackRecord | null> {
    const updatedAt = this.now();
    const result = await this.db.run(
      `UPDATE feedback
       SET applied = ?, updated_at = ?
       WHERE uuid = ?;`,
      [applied ? 1 : 0, updatedAt, feedbackId]
    );
    if (result.changes === 0) {
      return null;
    }

    return await this.getById(feedbackId);
  }

  private assertAnchor(anchor: NonNullable<FeedbackRecord['startAnchor']>, kind: AnchorKind): void {
    if (!anchor.part.trim()) {
      throw new Error(`Anchor part is required (${kind}).`);
    }
    if (anchor.paragraphIndex < 0 || anchor.runIndex < 0 || anchor.charOffset < 0) {
      throw new Error(`Anchor index fields must be non-negative (${kind}).`);
    }
  }

  private async insertAnchor(
    feedbackId: string,
    anchorKind: AnchorKind,
    anchor: NonNullable<FeedbackRecord['startAnchor']>
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO feedback_anchors
       (feedback_uuid, anchor_kind, part, paragraph_index, run_index, text_node_index, char_offset)
       VALUES (?, ?, ?, ?, ?, 0, ?);`,
      [feedbackId, anchorKind, anchor.part, anchor.paragraphIndex, anchor.runIndex, anchor.charOffset]
    );
  }

  private mapRowToRecord(
    row: FeedbackRow,
    anchors: Map<AnchorKind, FeedbackAnchorRow> | undefined
  ): FeedbackRecord {
    const base: FeedbackRecord = {
      id: row.uuid,
      fileId: row.entity_uuid,
      kind: row.kind,
      source: row.source,
      commentText: row.comment_text,
      applied: row.applied === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at ?? undefined
    };

    if (row.kind === 'block') {
      return base;
    }

    const start = anchors?.get('start');
    const end = anchors?.get('end');
    if (!start || !end) {
      throw new Error(`Inline feedback ${row.uuid} is missing required anchors.`);
    }

    return {
      ...base,
      kind: 'inline',
      exactQuote: row.exact_quote ?? '',
      prefixText: row.prefix_text ?? '',
      suffixText: row.suffix_text ?? '',
      startAnchor: {
        part: start.part,
        paragraphIndex: start.paragraph_index,
        runIndex: start.run_index,
        charOffset: start.char_offset
      },
      endAnchor: {
        part: end.part,
        paragraphIndex: end.paragraph_index,
        runIndex: end.run_index,
        charOffset: end.char_offset
      }
    };
  }
}
