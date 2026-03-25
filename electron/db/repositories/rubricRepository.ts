import { getSharedDatabaseClient } from '../appDatabase';
import { randomUUID } from 'node:crypto';
import type { SQLiteClient } from '../sqlite';
import { ensureEntity, ensureFileRecord } from './sqlHelpers';
import type {
  ClearAppliedRubricResponse,
  FileRubricInstanceDto,
  FileRubricScoreDto,
  GetRubricGradingContextResponse,
  GetRubricMatrixResponse,
  RubricDetailDto,
  RubricDto,
  RubricScoreDto,
  UpdateRubricOperation
} from '../../../shared/rubricContracts';

interface RubricRepositoryOptions {
  now?: () => string;
  db?: SQLiteClient;
}

interface RubricRow {
  entity_uuid: string;
  name: string | null;
  type: 'flat' | 'detailed' | null;
  is_active: number | null;
  is_archived: number | null;
}

interface RubricDetailRow {
  uuid: string;
  entity_uuid: string;
  category: string;
  description: string;
}

interface RubricScoreRow {
  uuid: string;
  details_uuid: string;
  score_values: number;
}

interface RubricInstanceRow {
  uuid: string;
  file_entity_uuid: string;
  rubric_entity_uuid: string;
  created_at: string;
  edited_at: string | null;
}

interface RubricInstanceScoreRow {
  uuid: string;
  rubric_instance_uuid: string;
  rubric_detail_uuid: string;
  assigned_score: string;
  created_at: string;
  edited_at: string | null;
}

interface RubricLastUsedRow {
  profile_key: string;
  rubric_entity_uuid: string;
  updated_at: string;
}

interface FilepathRubricAssociationRow {
  filepath_uuid: string;
  rubric_entity_uuid: string;
  created_at: string;
  edited_at: string | null;
}

type RubricUpdateStatus = 'updated' | 'not_found' | 'inactive' | 'archived';
type RubricDeleteStatus = 'deleted' | 'not_found' | 'active' | 'in_use';

export class RubricRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: RubricRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async listRubrics(): Promise<RubricDto[]> {
    const rows = await this.db.all<RubricRow>(
      `SELECT entity_uuid, name, type, is_active, is_archived
       FROM rubrics
       WHERE is_archived = 0
       ORDER BY name COLLATE NOCASE ASC, entity_uuid ASC;`
    );

    return rows.map((row) => ({
      entityUuid: row.entity_uuid,
      name: row.name ?? 'Untitled rubric',
      type: row.type ?? 'detailed',
      isActive: row.is_active === 1,
      isArchived: row.is_archived === 1
    }));
  }

  async createRubric(name = 'New Rubric', profileKey = 'default'): Promise<string> {
    const nowIso = this.now();
    const rubricId = randomUUID();
    const rubricName = name.trim() || 'New Rubric';
    const categoryNames = ['Category 1', 'Category 2', 'Category 3'];
    const scoreValues = [5, 4, 3, 2, 1];

    await this.db.exec('BEGIN;');
    try {
      await ensureEntity(this.db, rubricId, 'rubric', nowIso);
      await this.db.run(
        `INSERT INTO rubrics (entity_uuid, name, type, is_active, is_archived)
         VALUES (?, ?, 'detailed', 0, 0);`,
        [rubricId, rubricName]
      );

      for (const categoryName of categoryNames) {
        for (const scoreValue of scoreValues) {
          const detailId = randomUUID();
          await this.db.run(
            `INSERT INTO rubric_details (uuid, entity_uuid, category, description)
             VALUES (?, ?, ?, ?);`,
            [detailId, rubricId, categoryName, `${categoryName} at ${scoreValue} points`]
          );
          await this.db.run(
            `INSERT INTO rubric_scores (uuid, details_uuid, score_values)
             VALUES (?, ?, ?);`,
            [randomUUID(), detailId, scoreValue]
          );
        }
      }

      await this.db.run(
        `INSERT INTO rubric_last_used (profile_key, rubric_entity_uuid, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(profile_key)
         DO UPDATE SET rubric_entity_uuid = excluded.rubric_entity_uuid, updated_at = excluded.updated_at;`,
        [profileKey, rubricId, nowIso]
      );

      await this.db.exec('COMMIT;');
      return rubricId;
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async cloneRubric(rubricId: string, profileKey = 'default'): Promise<string | null> {
    const sourceRubric = await this.db.get<RubricRow>(
      `SELECT entity_uuid, name, type, is_active, is_archived
       FROM rubrics
       WHERE entity_uuid = ?
       LIMIT 1;`,
      [rubricId]
    );
    if (!sourceRubric || sourceRubric.is_archived === 1) {
      return null;
    }

    const sourceDetails = await this.db.all<RubricDetailRow>(
      `SELECT uuid, entity_uuid, category, description
       FROM rubric_details
       WHERE entity_uuid = ?
       ORDER BY uuid ASC;`,
      [rubricId]
    );

    const sourceDetailIds = sourceDetails.map((detail) => detail.uuid);
    let sourceScores: RubricScoreRow[] = [];
    if (sourceDetailIds.length > 0) {
      const placeholders = sourceDetailIds.map(() => '?').join(', ');
      sourceScores = await this.db.all<RubricScoreRow>(
        `SELECT uuid, details_uuid, score_values
         FROM rubric_scores
         WHERE details_uuid IN (${placeholders})
         ORDER BY uuid ASC;`,
        sourceDetailIds
      );
    }

    const nowIso = this.now();
    const clonedRubricId = randomUUID();
    const clonedRubricName = `${(sourceRubric.name ?? 'Untitled rubric').trim() || 'Untitled rubric'} cloned`;
    const detailIdMap = new Map<string, string>();

    await this.db.exec('BEGIN;');
    try {
      await ensureEntity(this.db, clonedRubricId, 'rubric', nowIso);
      await this.db.run(
        `INSERT INTO rubrics (entity_uuid, name, type, is_active, is_archived)
         VALUES (?, ?, ?, 0, 0);`,
        [clonedRubricId, clonedRubricName, sourceRubric.type ?? 'detailed']
      );

      for (const sourceDetail of sourceDetails) {
        const clonedDetailId = randomUUID();
        detailIdMap.set(sourceDetail.uuid, clonedDetailId);
        await this.db.run(
          `INSERT INTO rubric_details (uuid, entity_uuid, category, description)
           VALUES (?, ?, ?, ?);`,
          [clonedDetailId, clonedRubricId, sourceDetail.category, sourceDetail.description]
        );
      }

      for (const sourceScore of sourceScores) {
        const clonedDetailId = detailIdMap.get(sourceScore.details_uuid);
        if (!clonedDetailId) {
          continue;
        }
        await this.db.run(
          `INSERT INTO rubric_scores (uuid, details_uuid, score_values)
           VALUES (?, ?, ?);`,
          [randomUUID(), clonedDetailId, sourceScore.score_values]
        );
      }

      await this.db.run(
        `INSERT INTO rubric_last_used (profile_key, rubric_entity_uuid, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(profile_key)
         DO UPDATE SET rubric_entity_uuid = excluded.rubric_entity_uuid, updated_at = excluded.updated_at;`,
        [profileKey, clonedRubricId, nowIso]
      );

      await this.db.exec('COMMIT;');
      return clonedRubricId;
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async deleteRubric(rubricId: string): Promise<RubricDeleteStatus> {
    const existingRubric = await this.db.get<{ entity_uuid: string; is_active: number }>(
      'SELECT entity_uuid, is_active FROM rubrics WHERE entity_uuid = ? LIMIT 1;',
      [rubricId]
    );
    if (!existingRubric) {
      return 'not_found';
    }
    if (existingRubric.is_active === 1) {
      return 'active';
    }

    await this.db.exec('BEGIN;');
    try {
      await this.db.run('DELETE FROM entities WHERE uuid = ?;', [rubricId]);
      await this.db.exec('COMMIT;');
      return 'deleted';
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      if (
        error instanceof Error &&
        (error.message.includes('FOREIGN KEY constraint failed') || error.message.includes('SQLITE_CONSTRAINT'))
      ) {
        return 'in_use';
      }
      throw error;
    }
  }

  async getLastUsedRubricId(profileKey = 'default'): Promise<string | null> {
    const row = await this.db.get<RubricLastUsedRow>(
      `SELECT rlu.profile_key, rlu.rubric_entity_uuid, rlu.updated_at
       FROM rubric_last_used rlu
       INNER JOIN rubrics r ON r.entity_uuid = rlu.rubric_entity_uuid
       WHERE rlu.profile_key = ?
         AND r.is_archived = 0
       LIMIT 1;`,
      [profileKey]
    );
    if (!row) {
      return null;
    }
    return row.rubric_entity_uuid;
  }

  async setLastUsedRubricId(rubricId: string, profileKey = 'default'): Promise<boolean> {
    const existingRubric = await this.db.get<{ entity_uuid: string }>(
      'SELECT entity_uuid FROM rubrics WHERE entity_uuid = ? AND is_archived = 0 LIMIT 1;',
      [rubricId]
    );
    if (!existingRubric) {
      return false;
    }

    const nowIso = this.now();
    await this.db.run(
      `INSERT INTO rubric_last_used (profile_key, rubric_entity_uuid, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(profile_key)
       DO UPDATE SET rubric_entity_uuid = excluded.rubric_entity_uuid, updated_at = excluded.updated_at;`,
      [profileKey, rubricId, nowIso]
    );
    return true;
  }

  async getRubricMatrix(rubricId: string): Promise<GetRubricMatrixResponse | null> {
    const row = await this.db.get<RubricRow>(
      `SELECT entity_uuid, name, type, is_active, is_archived
       FROM rubrics
       WHERE entity_uuid = ?
         AND is_archived = 0
       LIMIT 1;`,
      [rubricId]
    );
    if (!row) {
      return null;
    }

    const details = await this.db.all<RubricDetailRow>(
      `SELECT uuid, entity_uuid, category, description
       FROM rubric_details
       WHERE entity_uuid = ?
       ORDER BY category COLLATE NOCASE ASC, uuid ASC;`,
      [rubricId]
    );
    const detailIds = details.map((detail) => detail.uuid);
    let scores: RubricScoreRow[] = [];
    if (detailIds.length > 0) {
      const placeholders = detailIds.map(() => '?').join(', ');
      scores = await this.db.all<RubricScoreRow>(
        `SELECT uuid, details_uuid, score_values
         FROM rubric_scores
         WHERE details_uuid IN (${placeholders})
         ORDER BY score_values DESC, uuid ASC;`,
        detailIds
      );
    }

    return {
      rubric: {
        entityUuid: row.entity_uuid,
        name: row.name ?? 'Untitled rubric',
        type: row.type ?? 'detailed',
        isActive: row.is_active === 1,
        isArchived: row.is_archived === 1
      },
      details: details.map((detail): RubricDetailDto => ({
        uuid: detail.uuid,
        entityUuid: detail.entity_uuid,
        category: detail.category,
        description: detail.description
      })),
      scores: scores.map((score): RubricScoreDto => ({
        uuid: score.uuid,
        detailsUuid: score.details_uuid,
        scoreValues: score.score_values
      }))
    };
  }

  async updateRubricMatrix(rubricId: string, operation: UpdateRubricOperation): Promise<RubricUpdateStatus> {
    const existingRubric = await this.db.get<{ entity_uuid: string; is_active: number; is_archived: number }>(
      'SELECT entity_uuid, is_active, is_archived FROM rubrics WHERE entity_uuid = ? LIMIT 1;',
      [rubricId]
    );
    if (!existingRubric) {
      return 'not_found';
    }
    if (existingRubric.is_archived === 1) {
      return 'archived';
    }
    if (existingRubric.is_active === 1) {
      return 'inactive';
    }

    const nowIso = this.now();
    await this.db.exec('BEGIN;');
    try {
      if (operation.type === 'setRubricName') {
        await this.db.run('UPDATE rubrics SET name = ? WHERE entity_uuid = ?;', [operation.name, rubricId]);
      }

      if (operation.type === 'updateCellDescription') {
        await this.db.run(
          `UPDATE rubric_details
           SET description = ?
           WHERE uuid = ?
             AND entity_uuid = ?;`,
          [operation.description, operation.detailId, rubricId]
        );
      }

      if (operation.type === 'updateCategoryName') {
        await this.db.run(
          `UPDATE rubric_details
           SET category = ?
           WHERE entity_uuid = ?
             AND category = ?;`,
          [operation.to, rubricId, operation.from]
        );
      }

      if (operation.type === 'updateScoreValue') {
        await this.db.run(
          `UPDATE rubric_scores
           SET score_values = ?
           WHERE details_uuid IN (
             SELECT uuid
             FROM rubric_details
             WHERE entity_uuid = ?
           )
             AND score_values = ?;`,
          [operation.to, rubricId, operation.from]
        );
      }

      if (operation.type === 'createCategory') {
        const scoreRows = await this.db.all<{ score_values: number }>(
          `SELECT DISTINCT rs.score_values
           FROM rubric_scores rs
           INNER JOIN rubric_details rd ON rd.uuid = rs.details_uuid
           WHERE rd.entity_uuid = ?
           ORDER BY rs.score_values DESC;`,
          [rubricId]
        );
        const scoreValues = scoreRows.map((row) => row.score_values);

        for (const scoreValue of scoreValues) {
          const detailId = randomUUID();
          await this.db.run(
            `INSERT INTO rubric_details (uuid, entity_uuid, category, description)
             VALUES (?, ?, ?, ?);`,
            [detailId, rubricId, operation.name, '']
          );
          await this.db.run(
            `INSERT INTO rubric_scores (uuid, details_uuid, score_values)
             VALUES (?, ?, ?);`,
            [randomUUID(), detailId, scoreValue]
          );
        }
      }

      if (operation.type === 'createScore') {
        const categoryRows = await this.db.all<{ category: string }>(
          `SELECT DISTINCT category
           FROM rubric_details
           WHERE entity_uuid = ?
           ORDER BY category COLLATE NOCASE ASC;`,
          [rubricId]
        );
        for (const categoryRow of categoryRows) {
          const detailId = randomUUID();
          await this.db.run(
            `INSERT INTO rubric_details (uuid, entity_uuid, category, description)
             VALUES (?, ?, ?, ?);`,
            [detailId, rubricId, categoryRow.category, '']
          );
          await this.db.run(
            `INSERT INTO rubric_scores (uuid, details_uuid, score_values)
             VALUES (?, ?, ?);`,
            [randomUUID(), detailId, operation.value]
          );
        }
      }

      if (operation.type === 'deleteCategory') {
        const detailRows = await this.db.all<{ uuid: string }>(
          `SELECT uuid
           FROM rubric_details
           WHERE entity_uuid = ? AND category = ?;`,
          [rubricId, operation.category]
        );
        const detailIds = detailRows.map((row) => row.uuid);
        if (detailIds.length > 0) {
          const placeholders = detailIds.map(() => '?').join(', ');
          await this.db.run(
            `DELETE FROM rubric_scores
             WHERE details_uuid IN (${placeholders});`,
            detailIds
          );
          await this.db.run(
            `DELETE FROM rubric_details
             WHERE uuid IN (${placeholders});`,
            detailIds
          );
        }
      }

      if (operation.type === 'deleteScore') {
        await this.db.run(
          `DELETE FROM rubric_scores
           WHERE details_uuid IN (
             SELECT uuid
             FROM rubric_details
             WHERE entity_uuid = ?
           )
             AND score_values = ?;`,
          [rubricId, operation.value]
        );
        await this.db.run(
          `DELETE FROM rubric_details
           WHERE entity_uuid = ?
             AND uuid NOT IN (
               SELECT DISTINCT details_uuid
               FROM rubric_scores
             );`,
          [rubricId]
        );
      }

      await this.db.exec('COMMIT;');
      return 'updated';
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async getFileRubricScores(fileId: string, rubricId: string): Promise<{
    instance: FileRubricInstanceDto | null;
    scores: FileRubricScoreDto[];
  }> {
    const instanceRow = await this.db.get<RubricInstanceRow>(
      `SELECT uuid, file_entity_uuid, rubric_entity_uuid, created_at, edited_at
       FROM file_rubric_instances
       WHERE file_entity_uuid = ? AND rubric_entity_uuid = ?
       ORDER BY COALESCE(edited_at, created_at) DESC, created_at DESC
       LIMIT 1;`,
      [fileId, rubricId]
    );
    if (!instanceRow) {
      return {
        instance: null,
        scores: []
      };
    }

    const scoreRows = await this.db.all<RubricInstanceScoreRow>(
      `SELECT uuid, rubric_instance_uuid, rubric_detail_uuid, assigned_score, created_at, edited_at
       FROM file_rubric_scores
       WHERE rubric_instance_uuid = ?
       ORDER BY created_at ASC, uuid ASC;`,
      [instanceRow.uuid]
    );

    return {
      instance: {
        uuid: instanceRow.uuid,
        fileEntityUuid: instanceRow.file_entity_uuid,
        rubricEntityUuid: instanceRow.rubric_entity_uuid,
        createdAt: instanceRow.created_at,
        editedAt: instanceRow.edited_at ?? undefined
      },
      scores: scoreRows.map((row) => ({
        uuid: row.uuid,
        rubricInstanceUuid: row.rubric_instance_uuid,
        rubricDetailUuid: row.rubric_detail_uuid,
        assignedScore: row.assigned_score,
        createdAt: row.created_at,
        editedAt: row.edited_at ?? undefined
      }))
    };
  }

  async getRubricGradingContext(fileId: string): Promise<GetRubricGradingContextResponse> {
    const normalizedFileId = fileId.trim();
    if (!normalizedFileId) {
      return { fileId };
    }

    const filepathRow = await this.db.get<{ filepath_uuid: string }>(
      'SELECT filepath_uuid FROM filename WHERE entity_uuid = ? LIMIT 1;',
      [normalizedFileId]
    );

    const lockedRow = filepathRow
      ? await this.db.get<{ rubric_entity_uuid: string }>(
          `SELECT rubric_entity_uuid
           FROM filepath_rubric_associations
           WHERE filepath_uuid = ?
           LIMIT 1;`,
          [filepathRow.filepath_uuid]
        )
      : undefined;

    const fileRow = await this.db.get<{ rubric_entity_uuid: string }>(
      `SELECT fri.rubric_entity_uuid
       FROM file_rubric_instances fri
       INNER JOIN file_rubric_scores frs ON frs.rubric_instance_uuid = fri.uuid
       WHERE fri.file_entity_uuid = ?
       ORDER BY COALESCE(fri.edited_at, fri.created_at) DESC, fri.created_at DESC
       LIMIT 1;`,
      [normalizedFileId]
    );

    return {
      fileId: normalizedFileId,
      lockedRubricId: lockedRow?.rubric_entity_uuid ?? undefined,
      selectedRubricIdForFile: fileRow?.rubric_entity_uuid ?? undefined
    };
  }

  async saveFileRubricScores(
    fileId: string,
    rubricId: string,
    selections: Array<{ rubricDetailId: string; assignedScore: string }>
  ): Promise<{ instance: FileRubricInstanceDto; scores: FileRubricScoreDto[] }> {
    const normalizedFileId = fileId.trim();
    const normalizedRubricId = rubricId.trim();
    const nowIso = this.now();
    await this.db.exec('BEGIN;');
    try {
      await ensureFileRecord(this.db, normalizedFileId, nowIso);
      await ensureEntity(this.db, normalizedRubricId, 'rubric', nowIso);

      const rubricExists = await this.db.get<{ entity_uuid: string; is_archived: number }>(
        'SELECT entity_uuid, is_archived FROM rubrics WHERE entity_uuid = ? LIMIT 1;',
        [normalizedRubricId]
      );
      if (!rubricExists) {
        throw new Error(`Rubric does not exist: ${normalizedRubricId}`);
      }
      if (rubricExists.is_archived === 1) {
        throw new Error(`Rubric is archived: ${normalizedRubricId}`);
      }

      const fileRow = await this.db.get<{ filepath_uuid: string }>(
        'SELECT filepath_uuid FROM filename WHERE entity_uuid = ? LIMIT 1;',
        [normalizedFileId]
      );
      if (!fileRow) {
        throw new Error(`File does not exist: ${normalizedFileId}`);
      }

      const association = await this.db.get<FilepathRubricAssociationRow>(
        `SELECT filepath_uuid, rubric_entity_uuid, created_at, edited_at
         FROM filepath_rubric_associations
         WHERE filepath_uuid = ?
         LIMIT 1;`,
        [fileRow.filepath_uuid]
      );
      if (association && association.rubric_entity_uuid !== normalizedRubricId) {
        throw new Error('A different rubric is already applied to this folder. Use Change Rubric to replace it.');
      }

      await this.db.run(
        `INSERT INTO filepath_rubric_associations (filepath_uuid, rubric_entity_uuid, created_at, edited_at)
         VALUES (?, ?, ?, NULL)
         ON CONFLICT(filepath_uuid)
         DO UPDATE SET rubric_entity_uuid = excluded.rubric_entity_uuid, edited_at = excluded.created_at;`,
        [fileRow.filepath_uuid, normalizedRubricId, nowIso]
      );
      await this.db.run('UPDATE rubrics SET is_active = 1 WHERE entity_uuid = ?;', [normalizedRubricId]);

      const normalizedSelections = selections
        .map((selection) => ({
          rubricDetailId: selection.rubricDetailId.trim(),
          assignedScore: selection.assignedScore.trim()
        }))
        .filter((selection) => selection.rubricDetailId.length > 0 && selection.assignedScore.length > 0);

      if (normalizedSelections.length === 0) {
        throw new Error('At least one rubric score selection is required.');
      }

      let instanceRow = await this.db.get<RubricInstanceRow>(
        `SELECT uuid, file_entity_uuid, rubric_entity_uuid, created_at, edited_at
         FROM file_rubric_instances
         WHERE file_entity_uuid = ? AND rubric_entity_uuid = ?
         ORDER BY COALESCE(edited_at, created_at) DESC, created_at DESC
         LIMIT 1;`,
        [normalizedFileId, normalizedRubricId]
      );

      if (!instanceRow) {
        const instanceId = randomUUID();
        await this.db.run(
          `INSERT INTO file_rubric_instances (uuid, file_entity_uuid, rubric_entity_uuid, created_at, edited_at)
           VALUES (?, ?, ?, ?, NULL);`,
          [instanceId, normalizedFileId, normalizedRubricId, nowIso]
        );
        instanceRow = {
          uuid: instanceId,
          file_entity_uuid: normalizedFileId,
          rubric_entity_uuid: normalizedRubricId,
          created_at: nowIso,
          edited_at: null
        };
      } else {
        await this.db.run(
          'UPDATE file_rubric_instances SET edited_at = ? WHERE uuid = ?;',
          [nowIso, instanceRow.uuid]
        );
        instanceRow = {
          ...instanceRow,
          edited_at: nowIso
        };
      }

      const seenDetailIds = new Set<string>();
      for (const selection of normalizedSelections) {
        const detailId = selection.rubricDetailId;
        if (!detailId || seenDetailIds.has(detailId)) {
          continue;
        }
        seenDetailIds.add(detailId);

        const detailBelongsToRubric = await this.db.get<{ uuid: string }>(
          'SELECT uuid FROM rubric_details WHERE uuid = ? AND entity_uuid = ? LIMIT 1;',
          [detailId, normalizedRubricId]
        );
        if (!detailBelongsToRubric) {
          throw new Error(`Rubric detail does not exist for this rubric: ${detailId}`);
        }

        const existingScore = await this.db.get<{ uuid: string }>(
          `SELECT uuid
           FROM file_rubric_scores
           WHERE rubric_instance_uuid = ? AND rubric_detail_uuid = ?
           LIMIT 1;`,
          [instanceRow.uuid, detailId]
        );
        if (existingScore) {
          await this.db.run(
            `UPDATE file_rubric_scores
             SET assigned_score = ?, edited_at = ?
             WHERE uuid = ?;`,
            [selection.assignedScore, nowIso, existingScore.uuid]
          );
        } else {
          await this.db.run(
            `INSERT INTO file_rubric_scores
             (uuid, rubric_instance_uuid, rubric_detail_uuid, assigned_score, created_at, edited_at)
             VALUES (?, ?, ?, ?, ?, NULL);`,
            [randomUUID(), instanceRow.uuid, detailId, selection.assignedScore, nowIso]
          );
        }
      }

      const keepDetailIds = Array.from(seenDetailIds);
      if (keepDetailIds.length > 0) {
        const placeholders = keepDetailIds.map(() => '?').join(', ');
        await this.db.run(
          `DELETE FROM file_rubric_scores
           WHERE rubric_instance_uuid = ?
             AND rubric_detail_uuid NOT IN (${placeholders});`,
          [instanceRow.uuid, ...keepDetailIds]
        );
      } else {
        await this.db.run('DELETE FROM file_rubric_scores WHERE rubric_instance_uuid = ?;', [instanceRow.uuid]);
      }

      await this.db.exec('COMMIT;');

      const saved = await this.getFileRubricScores(normalizedFileId, normalizedRubricId);
      if (!saved.instance) {
        throw new Error('Saved rubric instance could not be loaded.');
      }
      return {
        instance: saved.instance,
        scores: saved.scores
      };
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }

  async clearAppliedRubricForFilepath(fileId: string, rubricId: string): Promise<ClearAppliedRubricResponse | null> {
    const normalizedFileId = fileId.trim();
    const normalizedRubricId = rubricId.trim();
    if (!normalizedFileId) {
      return null;
    }
    if (!normalizedRubricId) {
      return null;
    }

    const fileRow = await this.db.get<{ filepath_uuid: string }>(
      'SELECT filepath_uuid FROM filename WHERE entity_uuid = ? LIMIT 1;',
      [normalizedFileId]
    );
    if (!fileRow) {
      return null;
    }

    const association = await this.db.get<FilepathRubricAssociationRow>(
      `SELECT filepath_uuid, rubric_entity_uuid, created_at, edited_at
       FROM filepath_rubric_associations
       WHERE filepath_uuid = ?
         AND rubric_entity_uuid = ?
       LIMIT 1;`,
      [fileRow.filepath_uuid, normalizedRubricId]
    );
    if (!association) {
      return null;
    }

    await this.db.exec('BEGIN;');
    try {
      await this.db.run(
        'DELETE FROM filepath_rubric_associations WHERE filepath_uuid = ? AND rubric_entity_uuid = ?;',
        [association.filepath_uuid, association.rubric_entity_uuid]
      );
      await this.db.run(
        `DELETE FROM file_rubric_scores
         WHERE rubric_instance_uuid IN (
           SELECT fri.uuid
           FROM file_rubric_instances fri
           INNER JOIN filename fn ON fn.entity_uuid = fri.file_entity_uuid
           WHERE fn.filepath_uuid = ?
             AND fri.rubric_entity_uuid = ?
         );`,
        [association.filepath_uuid, association.rubric_entity_uuid]
      );
      await this.db.run(
        `DELETE FROM file_rubric_instances
         WHERE file_entity_uuid IN (
           SELECT entity_uuid FROM filename WHERE filepath_uuid = ?
         )
           AND rubric_entity_uuid = ?;`,
        [association.filepath_uuid, association.rubric_entity_uuid]
      );

      const remainingUsage = await this.db.get<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM file_rubric_scores frs
         INNER JOIN file_rubric_instances fri ON fri.uuid = frs.rubric_instance_uuid
         WHERE fri.rubric_entity_uuid = ?;`,
        [association.rubric_entity_uuid]
      );
      if ((remainingUsage?.count ?? 0) === 0) {
        await this.db.run('UPDATE rubrics SET is_active = 0 WHERE entity_uuid = ?;', [association.rubric_entity_uuid]);
      }

      await this.db.exec('COMMIT;');
      return {
        fileId: normalizedFileId,
        filepathId: association.filepath_uuid,
        clearedRubricId: association.rubric_entity_uuid
      };
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }
  }
}
