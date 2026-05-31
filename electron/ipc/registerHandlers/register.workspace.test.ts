import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { registerWorkspaceHandlers, WORKSPACE_CHANNELS } from './register.workspace';
import type { IpcMainLike } from '../types';

function createIpcHarness() {
  const handlers = new Map<string, (event: unknown, payload?: unknown) => unknown | Promise<unknown>>();
  const ipc: IpcMainLike = {
    handle: (channel, listener) => {
      handlers.set(channel, listener);
    }
  };
  return { ipc, handlers };
}

describe('registerWorkspaceHandlers', () => {
  it('persists generated docx files from html conversion during folder selection', async () => {
    const folderPath = '/workspace/essays';
    const htmlPath = path.join(folderPath, 'essay.html');
    const docxPath = path.join(folderPath, 'essay.docx');
    const upsertFiles = vi.fn().mockResolvedValue([]);
    const { ipc, handlers } = createIpcHarness();

    registerWorkspaceHandlers(ipc, {
      dialog: {
        showOpenDialog: vi.fn().mockResolvedValue({ canceled: false, filePaths: [folderPath] })
      },
      repository: {
        setCurrentFolder: vi.fn().mockResolvedValue({ id: 'folder-1', path: folderPath, name: 'essays' }),
        upsertFiles,
        listFiles: vi.fn(),
        getCurrentFolder: vi.fn()
      } as any,
      scanFiles: vi.fn().mockResolvedValue([{ path: htmlPath, name: 'essay.html', extension: 'html' }]),
      convertHtmlFiles: vi.fn().mockResolvedValue([{ path: docxPath, name: 'essay.docx', extension: 'docx' }])
    });

    const result = await handlers.get(WORKSPACE_CHANNELS.selectFolder)?.(null);

    expect(result).toEqual({ ok: true, data: { folder: { id: 'folder-1', path: folderPath, name: 'essays' } } });
    expect(upsertFiles).toHaveBeenCalledWith('folder-1', [
      {
        id: docxPath,
        folderId: 'folder-1',
        name: 'essay.docx',
        path: docxPath,
        kind: 'docx'
      }
    ]);
  });
});
