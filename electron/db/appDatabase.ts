import path from 'node:path';
import { SQLiteClient } from './sqlite';

let sharedClient: SQLiteClient | null = null;

function resolveDefaultDbPath(): string {
  if (process.env.VITEST) {
    return ':memory:';
  }

  try {
    const electron = require('electron') as typeof import('electron');
    const userDataPath = electron.app?.getPath?.('userData');
    if (typeof userDataPath === 'string' && userDataPath.length > 0) {
      return path.join(userDataPath, 'essaylens.sqlite3');
    }
  } catch {
    // Ignore fallback path resolution errors.
  }

  return path.resolve(process.cwd(), 'essaylens.sqlite3');
}

export function getSharedDatabaseClient(): SQLiteClient {
  if (process.env.VITEST) {
    return new SQLiteClient({ dbPath: ':memory:' });
  }

  if (sharedClient) {
    return sharedClient;
  }

  sharedClient = new SQLiteClient({ dbPath: resolveDefaultDbPath() });
  return sharedClient;
}
