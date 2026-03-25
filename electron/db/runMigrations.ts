import { SQLiteClient, type SQLiteMigration } from './sqlite';

/**
 * Run pending migrations on the given database client.
 * Assumes the client is already initialized and the migrations table exists.
 * This is called internally by SQLiteClient during initialization.
 */
export async function runMigrations(client: SQLiteClient): Promise<void> {
  const appliedRows = await client.all<{ id: string }>('SELECT id FROM _migrations;');
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of client.loadMigrations()) {
    if (applied.has(migration.id)) {
      continue;
    }

    await client.exec('BEGIN;');
    try {
      await client.exec(migration.sql);
      await client.run('INSERT INTO _migrations (id, applied_at) VALUES (?, ?);', [
        migration.id,
        new Date().toISOString()
      ]);
      await client.exec('COMMIT;');
    } catch (error) {
      await client.exec('ROLLBACK;');
      throw error;
    }
  }
}
