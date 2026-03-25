import path from 'node:path';

export type LlmRuntimeMode = 'dev' | 'packaged';

export interface ResolveLlamaServerPathOptions {
  mode: LlmRuntimeMode;
  platform?: NodeJS.Platform;
  arch?: string;
  resourcesPath?: string;
  devRootPath?: string;
}

function getDefaultDevRootPath(): string {
  return path.resolve(__dirname, '..', '..', '..');
}

export function resolveLlamaServerPath(options: ResolveLlamaServerPathOptions): string {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const executableName = platform === 'win32' ? 'llama-server.exe' : 'llama-server';
  const targetDir = `${platform}-${arch}`;

  if (options.mode === 'packaged') {
    const resourcesPath = options.resourcesPath ?? process.resourcesPath ?? process.cwd();
    return path.resolve(resourcesPath, 'llama-server', targetDir, executableName);
  }

  const devRootPath = options.devRootPath ?? getDefaultDevRootPath();
  return path.resolve(devRootPath, 'vendor', 'llama-server', targetDir, executableName);
}
