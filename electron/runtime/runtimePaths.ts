import { existsSync } from 'node:fs';
import path from 'node:path';

export type LlmRuntimeMode = 'dev' | 'packaged';

export interface ResolveLlamaServerPathOptions {
  mode: LlmRuntimeMode;
  platform?: NodeJS.Platform;
  arch?: string;
  resourcesPath?: string;
  devRootPath?: string;
}

export interface ResolveAssetPathOptions {
  mode: LlmRuntimeMode;
  assetRelativePath: string;
  resourcesPath?: string;
  devRootPath?: string;
}

function getDefaultDevRootPath(): string {
  return path.resolve(__dirname, '..', '..');
}

function resolveCandidateServerPath(rootPath: string, executableName: string, targetDir: string): string {
  const platformScopedPath = path.resolve(rootPath, 'llama-server', targetDir, executableName);
  if (existsSync(platformScopedPath)) {
    return platformScopedPath;
  }

  const flatPath = path.resolve(rootPath, executableName);
  if (existsSync(flatPath)) {
    return flatPath;
  }

  return platformScopedPath;
}

export function resolveLlamaServerPath(options: ResolveLlamaServerPathOptions): string {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const executableName = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const targetDir = `${platform}-${arch}`;

  if (options.mode === 'packaged') {
    const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? process.cwd();
    return resolveCandidateServerPath(resourcesPath, executableName, targetDir);
  }

  const devRootPath = options.devRootPath ?? getDefaultDevRootPath();
  return resolveCandidateServerPath(path.resolve(devRootPath, 'vendor'), executableName, targetDir);
}

export function resolveAssetPath(options: ResolveAssetPathOptions): string {
  if (options.mode === 'packaged') {
    const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? process.cwd();
    return path.resolve(resourcesPath, 'assets', options.assetRelativePath);
  }

  const devRootPath = options.devRootPath ?? getDefaultDevRootPath();
  return path.resolve(devRootPath, 'assets', options.assetRelativePath);
}
