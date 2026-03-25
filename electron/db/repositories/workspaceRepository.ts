import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getSharedDatabaseClient } from '../appDatabase';
import type { SQLiteClient } from '../sqlite';
import { ensureEntity } from './sqlHelpers';

export interface WorkspaceFolderRecord {
  id: string;
  path: string;
  name: string;
}

export interface WorkspaceFileRecord {
  id: string;
  folderId: string;
  name: string;
  path: string;
  kind: string;
}

interface WorkspaceRepositoryOptions {
  now?: () => string;
  db?: SQLiteClient;
}

interface FilepathRow {
  uuid: string;
  path: string;
  created_at: string;
}

interface WorkspaceFileRow {
  entity_uuid: string;
  filepath_uuid: string;
  append_path: string | null;
  file_name: string;
}

export interface ResolvedWorkspaceFileRecord {
  id: string;
  folderId: string;
  name: string;
  path: string;
}

function fileKindFromName(fileName: string): string {
  const extension = path.extname(fileName).replace('.', '').toLowerCase();
  switch (extension) {
    case 'docx':
    case 'pdf':
    case 'jpeg':
    case 'jpg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'svg':
    case 'heic':
    case 'heif':
    case 'avif':
    case 'tiff':
    case 'tif':
      return extension;
    default:
      return 'unknown';
  }
}

export class WorkspaceRepository {
  private readonly db: SQLiteClient;
  private readonly now: () => string;

  constructor(options: WorkspaceRepositoryOptions = {}) {
    this.db = options.db ?? getSharedDatabaseClient();
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async setCurrentFolder(folderPath: string): Promise<WorkspaceFolderRecord> {
    const normalizedPath = folderPath.trim();
    if (!normalizedPath) {
      throw new Error('Workspace folder path is required.');
    }

    const timestamp = this.now();
    const existing = await this.db.get<FilepathRow>(
      'SELECT uuid, path, created_at FROM filepath WHERE path = ? LIMIT 1;',
      [normalizedPath]
    );
    if (existing) {
      await this.db.run(
        `UPDATE filepath
         SET created_at = ?
         WHERE uuid = ?;`,
        [timestamp, existing.uuid]
      );
      return this.mapFolderRow({ ...existing, created_at: timestamp });
    }

    const folderId = randomUUID();
    await this.db.run(
      `INSERT INTO filepath (uuid, path, created_at)
       VALUES (?, ?, ?);`,
      [folderId, normalizedPath, timestamp]
    );

    return this.mapFolderRow({ uuid: folderId, path: normalizedPath, created_at: timestamp });
  }

  async getCurrentFolder(): Promise<WorkspaceFolderRecord | null> {
    const row = await this.db.get<FilepathRow>(
      'SELECT uuid, path, created_at FROM filepath ORDER BY created_at DESC LIMIT 1;'
    );

    if (!row) {
      return null;
    }

    return this.mapFolderRow(row);
  }

  async upsertFiles(folderId: string, files: WorkspaceFileRecord[]): Promise<WorkspaceFileRecord[]> {
    const normalizedFolderId = folderId.trim();
    if (!normalizedFolderId) {
      throw new Error('Workspace folder id is required.');
    }

    const folderRow = await this.db.get<FilepathRow>(
      'SELECT uuid, path, created_at FROM filepath WHERE uuid = ? LIMIT 1;',
      [normalizedFolderId]
    );
    if (!folderRow) {
      throw new Error(`Workspace folder does not exist for id: ${normalizedFolderId}`);
    }

    const timestamp = this.now();
    await this.db.exec('BEGIN;');
    try {
      await this.db.run(
        `UPDATE filepath
         SET created_at = ?
         WHERE uuid = ?;`,
        [timestamp, normalizedFolderId]
      );

      for (const file of files) {
        const relativePath = path.relative(folderRow.path, file.path);
        const relativeDir = path.dirname(relativePath);
        const appendPath = relativeDir === '.' ? null : relativeDir;
        const fileName = file.name.trim() || path.basename(file.path);
        const existing = await this.db.get<{ entity_uuid: string }>(
          `SELECT entity_uuid
           FROM filename
           WHERE filepath_uuid = ?
             AND file_name = ?
             AND ((append_path IS NULL AND ? IS NULL) OR append_path = ?)
           LIMIT 1;`,
          [normalizedFolderId, fileName, appendPath, appendPath]
        );
        const fileId = existing?.entity_uuid ?? randomUUID();

        if (!existing) {
          await ensureEntity(this.db, fileId, 'file', timestamp);
        }
        await this.db.run(
          `INSERT INTO filename (entity_uuid, filepath_uuid, append_path, file_name, created_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(entity_uuid)
           DO UPDATE SET
             filepath_uuid = excluded.filepath_uuid,
             append_path = excluded.append_path,
             file_name = excluded.file_name;`,
          [fileId, normalizedFolderId, appendPath, fileName, timestamp]
        );
      }

      await this.db.exec('COMMIT;');
    } catch (error) {
      await this.db.exec('ROLLBACK;');
      throw error;
    }

    return await this.listFiles(normalizedFolderId);
  }

  async resolveFileById(fileId: string): Promise<ResolvedWorkspaceFileRecord | null> {
    const normalizedFileId = fileId.trim();
    if (!normalizedFileId) {
      return null;
    }

    const row = await this.db.get<WorkspaceFileRow & { folder_path: string }>(
      `SELECT f.entity_uuid, f.filepath_uuid, f.append_path, f.file_name, p.path AS folder_path
       FROM filename AS f
       INNER JOIN filepath AS p ON p.uuid = f.filepath_uuid
       WHERE f.entity_uuid = ?
       LIMIT 1;`,
      [normalizedFileId]
    );
    if (!row) {
      return null;
    }

    const relativePath = row.append_path ? path.join(row.append_path, row.file_name) : row.file_name;
    const fullPath = path.resolve(row.folder_path, relativePath);
    return {
      id: row.entity_uuid,
      folderId: row.filepath_uuid,
      name: row.file_name,
      path: fullPath
    };
  }

  async listFiles(folderId: string): Promise<WorkspaceFileRecord[]> {
    const normalizedFolderId = folderId.trim();
    if (!normalizedFolderId) {
      return [];
    }

    const folderRow = await this.db.get<FilepathRow>(
      'SELECT uuid, path, created_at FROM filepath WHERE uuid = ? LIMIT 1;',
      [normalizedFolderId]
    );
    if (!folderRow) {
      return [];
    }

    const rows = await this.db.all<WorkspaceFileRow>(
      `SELECT entity_uuid, filepath_uuid, append_path, file_name
       FROM filename
       WHERE filepath_uuid = ?
       ORDER BY file_name COLLATE NOCASE ASC, entity_uuid ASC;`,
      [normalizedFolderId]
    );

    return rows.map((row) => {
      const relativePath = row.append_path ? path.join(row.append_path, row.file_name) : row.file_name;
      const fullPath = path.resolve(folderRow.path, relativePath);
      return {
        id: row.entity_uuid,
        folderId: row.filepath_uuid,
        name: row.file_name,
        path: fullPath,
        kind: fileKindFromName(row.file_name)
      };
    });
  }

  private mapFolderRow(row: FilepathRow): WorkspaceFolderRecord {
    return {
      id: row.uuid,
      path: row.path,
      name: row.path.split(/[\\/]/).filter(Boolean).pop() ?? row.path
    };
  }
}
