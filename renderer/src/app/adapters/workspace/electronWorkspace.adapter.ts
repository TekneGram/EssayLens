import { invokeRequest } from '@/app/invokeRequest';
import type { WorkspacePort, SelectFolderResponse, ListFilesResponse } from '@/app/ports/workspace.port';

export function createElectronWorkspaceAdapter(): WorkspacePort {
  return {
    selectFolder: () => invokeRequest<SelectFolderResponse>('workspace/selectFolder'),
    listFiles: (folderId) => invokeRequest<ListFilesResponse>('workspace/listFiles', { folderId })
  };
}
