import { SQLiteClient } from './sqlite';
import { getSharedDatabaseClient } from './appDatabase';

/**
 * Initialize the application database.
 * This opens the database connection and runs all pending migrations.
 * Returns the shared SQLiteClient instance.
 */
export async function initializeDatabase(): Promise<SQLiteClient> {
  const client = getSharedDatabaseClient();
  await client.initialize();
  return client;
}
