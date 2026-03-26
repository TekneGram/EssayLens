import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { DownloadProgressEvent, LlmModelKey } from '../../ipc/contracts/llmManager.contracts';

export interface LlmDownloadSpec {
  key: LlmModelKey;
  hfRepoId: string;
  hfFilename: string;
  onProgress?: (event: DownloadProgressEvent) => void;
}

export interface LlmModelDownloaderDeps {
  getUserDataPath: () => string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
}

function getDefaultDeps(): LlmModelDownloaderDeps {
  return {
    getUserDataPath: () => {
      const electron = require('electron') as typeof import('electron');
      return electron.app.getPath('userData');
    },
    fetchImpl: fetch,
    timeoutMs: 20 * 60 * 1000
  };
}

function buildDownloadUrl(hfRepoId: string, hfFilename: string): string {
  return `https://huggingface.co/${hfRepoId}/resolve/main/${encodeURIComponent(hfFilename)}?download=true`;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsPromises.access(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return String(error);
}

export async function downloadModelFile(spec: LlmDownloadSpec, overrides: Partial<LlmModelDownloaderDeps> = {}): Promise<string> {
  const deps = {
    ...getDefaultDeps(),
    ...overrides
  };

  const modelsRoot = path.join(deps.getUserDataPath(), 'models', spec.key);
  const targetPath = path.join(modelsRoot, spec.hfFilename);
  await fsPromises.mkdir(modelsRoot, { recursive: true });
  spec.onProgress?.({
    key: spec.key,
    phase: 'starting',
    bytesReceived: 0,
    bytesTotal: null,
    percent: null,
    status: 'Starting download',
    errorMessage: null
  });

  if (await pathExists(targetPath)) {
    spec.onProgress?.({
      key: spec.key,
      phase: 'downloading',
      bytesReceived: 0,
      bytesTotal: 0,
      percent: 100,
      status: 'Model already present',
      errorMessage: null
    });
    return targetPath;
  }

  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), deps.timeoutMs);

  try {
    const response = await deps.fetchImpl(buildDownloadUrl(spec.hfRepoId, spec.hfFilename), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Hugging Face download failed with HTTP ${response.status} ${response.statusText}.`);
    }
    if (!response.body) {
      throw new Error('Hugging Face download returned an empty response body.');
    }
    const writer = fs.createWriteStream(tempPath, { flags: 'wx' });
    const reader = response.body.getReader();
    const bytesTotalHeader = response.headers.get('content-length');
    const bytesTotal = bytesTotalHeader ? Number.parseInt(bytesTotalHeader, 10) : null;
    let bytesReceived = 0;
    let lastEmittedPercent = -1;
    let lastEmitTs = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      bytesReceived += value.byteLength;
      await new Promise<void>((resolve, reject) => {
        writer.write(Buffer.from(value), (error) => (error ? reject(error) : resolve()));
      });

      const percent = bytesTotal && bytesTotal > 0 ? Math.min(100, Math.floor((bytesReceived / bytesTotal) * 100)) : null;
      const now = Date.now();
      const shouldEmitPercent = percent !== null && percent > lastEmittedPercent;
      const shouldEmitTick = now - lastEmitTs >= 200;
      if (shouldEmitPercent || shouldEmitTick) {
        lastEmitTs = now;
        if (percent !== null) {
          lastEmittedPercent = percent;
        }
        spec.onProgress?.({
          key: spec.key,
          phase: 'downloading',
          bytesReceived,
          bytesTotal: bytesTotal && Number.isFinite(bytesTotal) ? bytesTotal : null,
          percent,
          status: 'Downloading model',
          errorMessage: null
        });
      }
    }
    await new Promise<void>((resolve, reject) =>
      writer.end((error?: Error | null) => (error ? reject(error) : resolve()))
    );

    try {
      await fsPromises.rename(tempPath, targetPath);
    } catch (error) {
      if ((await pathExists(targetPath)) === true) {
        await fsPromises.rm(tempPath, { force: true });
        return targetPath;
      }
      throw error;
    }

    return targetPath;
  } catch (error) {
    await fsPromises.rm(tempPath, { force: true });
    throw new Error(`Failed to download model ${spec.key}: ${toErrorMessage(error)}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
