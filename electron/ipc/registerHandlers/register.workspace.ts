import path from 'node:path';
import type {
  GetCurrentFolderResponse,
  ListFilesRequest,
  ListFilesResponse,
  SelectFolderResponse,
  WorkspaceFileDto
} from '../contracts/workspace.contracts';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { scanFilesInWorkspace, type ScannedFile } from '../../services/workspace/fileScanner';
import type { IpcMainLike } from '../types';
import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { workspaceSchemas } from '../validationSchemas/workspace.schemas';
import { AppException } from '../../core/appException';

export const WORKSPACE_CHANNELS = {
  selectFolder: 'workspace/selectFolder',
  listFiles: 'workspace/listFiles',
  getCurrentFolder: 'workspace/getCurrentFolder'
} as const;

interface OpenDialogResult {
  canceled: boolean;
  filePaths: string[];
}

interface DialogLike {
  showOpenDialog(options: { properties: Array<'openDirectory'>; title: string }): Promise<OpenDialogResult>;
}

interface WorkspaceHandlerDeps {
  dialog: DialogLike;
  repository: WorkspaceRepository;
  scanFiles: (folderPath: string) => Promise<ScannedFile[]>;
}

function getDefaultDeps(): WorkspaceHandlerDeps {
  const electron = require('electron') as typeof import('electron');
  return {
    dialog: electron.dialog,
    repository: new WorkspaceRepository(),
    scanFiles: scanFilesInWorkspace
  };
}

function fileKindFromPath(filePath: string): string {
  const extension = path.extname(filePath).replace('.', '').toLowerCase();
  switch (extension) {
    case 'docx':
    case 'pdf':
    case 'jpeg':
    case 'jpg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'bmp':
    case 'svg':
    case 'heic':
    case 'heif':
    case 'avif':
    case 'tiff':
    case 'tif':
      return extension;
    default:
      return 'unknown';
  }
}

function toWorkspaceFileDtos(folderId: string, scannedFiles: ScannedFile[]): WorkspaceFileDto[] {
  return scannedFiles
    .map((file) => {
      const kind = fileKindFromPath(file.path);
      return {
        id: file.path,
        folderId,
        name: file.name,
        path: file.path,
        kind
      };
    })
    .filter((file) => file.kind !== 'unknown');
}

export function registerWorkspaceHandlers(ipc: IpcMainLike, deps: WorkspaceHandlerDeps = getDefaultDeps()): void {
  safeHandle<unknown, SelectFolderResponse>(ipc, WORKSPACE_CHANNELS.selectFolder, async (_args, _ctx) => {
    const selection = await deps.dialog.showOpenDialog({
      title: 'Select Workspace Folder',
      properties: ['openDirectory']
    });
    const selectedPath = selection.filePaths[0];
    if (selection.canceled || !selectedPath) {
      return { folder: null };
    }

    try {
      const folder = await deps.repository.setCurrentFolder(selectedPath);
      const scannedFiles = await deps.scanFiles(folder.path);
      const fileRecords = toWorkspaceFileDtos(folder.id, scannedFiles);
      await deps.repository.upsertFiles(folder.id, fileRecords);

      return { folder };
    } catch (error) {
      throw new AppException({
        code: 'WORKSPACE_SELECT_FOLDER_FAILED',
        userMessage: 'Could not select a folder.',
        details: error
      });
    }
  });

  safeHandle<ListFilesRequest, ListFilesResponse>(ipc, WORKSPACE_CHANNELS.listFiles, async (rawArgs, _ctx) => {
    const { folderId } = validateOrThrow(workspaceSchemas.listFiles, rawArgs);

    try {
      const files = await deps.repository.listFiles(folderId);
      return { files };
    } catch (error) {
      throw new AppException({
        code: 'WORKSPACE_LIST_FILES_FAILED',
        userMessage: 'Could not load files for selected folder.',
        details: error
      });
    }
  });

  safeHandle<unknown, GetCurrentFolderResponse>(ipc, WORKSPACE_CHANNELS.getCurrentFolder, async (_args, _ctx) => {
    try {
      const folder = await deps.repository.getCurrentFolder();
      return { folder };
    } catch (error) {
      throw new AppException({
        code: 'WORKSPACE_GET_CURRENT_FOLDER_FAILED',
        userMessage: 'Could not load current folder.',
        details: error
      });
    }
  });
}
