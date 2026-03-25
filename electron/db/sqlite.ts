import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';

export interface SQLiteOptions {
  dbPath: string;
  migrationsDir?: string;
}

export interface SQLiteMigration {
  id: string;
  filePath: string;
  sql: string;
}

export type SQLiteParam = string | number | null;

export class SQLiteClient {
  private readonly dbPath: string;
  private readonly migrationsDir: string;
  private initialized = false;
  private database: sqlite3.Database | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(options: SQLiteOptions) {
    this.dbPath = options.dbPath;
    this.migrationsDir = options.migrationsDir ?? resolveDefaultMigrationsDir();
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = this.openAndMigrate();
    try {
      await this.initPromise;
      this.initialized = true;
    } finally {
      this.initPromise = null;
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  getPath(): string {
    return this.dbPath;
  }

  getMigrationsDir(): string {
    return this.migrationsDir;
  }

  loadMigrations(): SQLiteMigration[] {
    const migrationFiles = readdirSync(this.migrationsDir)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    return migrationFiles.map((fileName) => {
      const filePath = path.join(this.migrationsDir, fileName);
      return {
        id: fileName.replace(/\.sql$/, ''),
        filePath,
        sql: readFileSync(filePath, 'utf8')
      };
    });
  }

  async run(sql: string, params: SQLiteParam[] = []): Promise<{ changes: number; lastID: number }> {
    const db = await this.getDatabase();
    return await new Promise((resolve, reject) => {
      db.run(sql, params, function onRun(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({
          changes: this.changes ?? 0,
          lastID: this.lastID ?? 0
        });
      });
    });
  }

  async get<TRow extends object>(sql: string, params: SQLiteParam[] = []): Promise<TRow | undefined> {
    const db = await this.getDatabase();
    return await new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((row as TRow | undefined) ?? undefined);
      });
    });
  }

  async all<TRow extends object>(sql: string, params: SQLiteParam[] = []): Promise<TRow[]> {
    const db = await this.getDatabase();
    return await new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve((rows as TRow[]) ?? []);
      });
    });
  }

  async exec(sql: string): Promise<void> {
    const db = await this.getDatabase();
    await new Promise<void>((resolve, reject) => {
      db.exec(sql, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    const db = this.database;
    this.database = null;
    this.initialized = false;
    this.initPromise = null;
    if (!db) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      db.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  private async openAndMigrate(): Promise<void> {
    const db = await new Promise<sqlite3.Database>((resolve, reject) => {
      const created = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(created);
      });
    });

    this.database = db;

    try {
      await this.exec('PRAGMA foreign_keys = ON;');
      await this.exec('PRAGMA journal_mode = WAL;');
      await this.exec('CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL);');

      const appliedRows = await this.all<{ id: string }>('SELECT id FROM _migrations;');
      const applied = new Set(appliedRows.map((row) => row.id));

      for (const migration of this.loadMigrations()) {
        if (applied.has(migration.id)) {
          continue;
        }

        await this.exec('BEGIN;');
        try {
          await this.exec(migration.sql);
          await this.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', [migration.id, new Date().toISOString()]);
          await this.exec('COMMIT;');
        } catch (error) {
          await this.exec('ROLLBACK;');
          throw error;
        }
      }
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  private async getDatabase(): Promise<sqlite3.Database> {
    if (this.database) {
      return this.database;
    }

    await this.initialize();
    if (!this.database) {
      throw new Error('SQLite database is not initialized.');
    }
    return this.database;
  }
}

function resolveDefaultMigrationsDir(): string {
  try {
    const electron = require('electron') as typeof import('electron');
    if (electron.app?.isPackaged) {
      return path.resolve(process.resourcesPath, 'db', 'migrations');
    }
  } catch {
    // Ignore electron resolution errors and fall back to dev path.
  }

  return path.resolve(process.cwd(), 'electron/db/migrations');
}
