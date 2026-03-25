import fs from 'node:fs/promises';
import path from 'node:path';
import { LlmSettingsRepository } from '../db/repositories/llmSettingsRepository';
import { resolveLlamaServerPath } from './runtimePaths';

type RuntimeSettingsRepo = Pick<LlmSettingsRepository, 'getRuntimeSettings' | 'updateRuntimeSettings'>;

interface LlmServerPathReconcilerDeps {
  settingsRepository?: RuntimeSettingsRepo;
  pathExists?: (targetPath: string) => Promise<boolean>;
  resolveDevServerPath?: () => string;
  isDevMode?: () => boolean;
  logWarn?: (message: string, details?: unknown) => void;
}

function defaultIsDevMode(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL) || process.env.NODE_ENV === 'development';
}

async function defaultPathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toPosixPath(value: string): string {
  return value.replace(/\\/g, '/');
}

function looksPackagedPath(targetPath: string): boolean {
  const normalized = toPosixPath(targetPath);
  return normalized.includes('/Contents/Resources/llama-server/') || normalized.includes('/dist/');
}

export async function reconcileDevLlmServerPath(deps: LlmServerPathReconcilerDeps = {}): Promise<void> {
  const isDevMode = deps.isDevMode ?? defaultIsDevMode;
  if (!isDevMode()) {
    return;
  }

  const settingsRepository = deps.settingsRepository ?? new LlmSettingsRepository();
  const resolveDevServerPath =
    deps.resolveDevServerPath ??
    (() =>
      resolveLlamaServerPath({
        mode: 'dev'
      }));
  const pathExists = deps.pathExists ?? defaultPathExists;
  const logWarn = deps.logWarn ?? ((message: string, details?: unknown) => console.warn(message, details));

  try {
    const settings = await settingsRepository.getRuntimeSettings();
    const expectedDevPath = resolveDevServerPath();
    const currentPath = settings.llm_server_path?.trim() ?? '';
    const currentPathExists = currentPath ? await pathExists(currentPath) : false;
    const shouldReset = !currentPath || !currentPathExists || looksPackagedPath(currentPath);

    if (!shouldReset || currentPath === expectedDevPath) {
      return;
    }

    await settingsRepository.updateRuntimeSettings({ llm_server_path: expectedDevPath });
  } catch (error) {
    logWarn('Could not reconcile dev llama-server path.', error);
  }
}
