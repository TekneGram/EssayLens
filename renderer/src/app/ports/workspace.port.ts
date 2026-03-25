import type { AppResult } from '@/app/result';

// --- Workspace contract types ---

export interface WorkspaceFolderDto {
  id: string;
  path: string;
  name: string;
}

export interface WorkspaceFileDto {
  id: string;
  folderId: string;
  name: string;
  path: string;
  kind: string;
}

export interface SelectFolderResponse {
  folder: WorkspaceFolderDto | null;
}

export interface ListFilesResponse {
  files: WorkspaceFileDto[];
}

// --- Port interface ---

export type SelectFolderResult = AppResult<SelectFolderResponse>;
export type ListFilesResult = AppResult<ListFilesResponse>;

export interface WorkspacePort {
  selectFolder(): Promise<SelectFolderResult>;
  listFiles(folderId: string): Promise<ListFilesResult>;
}
