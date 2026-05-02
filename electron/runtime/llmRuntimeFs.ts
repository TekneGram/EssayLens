import fsPromises from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { resolveLlamaServerPath } from './runtimePaths';

export async function defaultFileExists(targetPath: string): Promise<boolean> {
  try {
    await fsPromises.access(targetPath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function defaultIsExecutable(targetPath: string): Promise<boolean> {
  if (process.platform === 'win32') return true;
  try {
    await fsPromises.access(targetPath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function defaultIsFile(targetPath: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(targetPath);
    return stats.isFile();
  } catch {
    return false;
  }
}

export function resolveDefaultLlmServerPath(): string {
  const runtimeMode = process.env.VITE_DEV_SERVER_URL || process.env.NODE_ENV === 'development' ? 'dev' : 'packaged';
  return resolveLlamaServerPath({ mode: runtimeMode });
}
