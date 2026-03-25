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

export interface ListFilesRequest {
  folderId: string;
}

export interface ListFilesResponse {
  files: WorkspaceFileDto[];
}

export interface GetCurrentFolderResponse {
  folder: WorkspaceFolderDto | null;
}
