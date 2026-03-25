import type { WorkspacePort } from '@/app/ports';

function getElectronWorkspaceApi(): WorkspacePort {
  const appWindow = window as Window & { api?: { workspace?: WorkspacePort } };
  if (!appWindow.api?.workspace) {
    throw new Error('window.api.workspace is not available.');
  }

  return appWindow.api.workspace;
}

export function createElectronWorkspaceAdapter(): WorkspacePort {
  return {
    selectFolder: () => getElectronWorkspaceApi().selectFolder(),
    listFiles: (folderId) => getElectronWorkspaceApi().listFiles(folderId)
  };
}
