import type { WorkspacePort } from '@/app/ports';
import { toWorkspaceFiles, toWorkspaceFolder } from '@/layout/FileControlContainer/domain/workspace.mappers';
import type { WorkspaceFile, WorkspaceFolder } from '@/layout/FileControlContainer/domain/workspace.types';

export interface SelectFolderResult {
    folder: WorkspaceFolder | null;
    files: WorkspaceFile[];
}

export async function selectWorkspaceFolder(workspacePort: WorkspacePort): Promise<SelectFolderResult> {
    const selectResult = await workspacePort.selectFolder();

    if (!selectResult.ok) {
        throw new Error(selectResult.error.message);
    }

    if (!selectResult.data.folder) {
        return { folder: null, files: [] };
    }

    const folder = toWorkspaceFolder(selectResult.data.folder);
    if (!folder) {
        return { folder: null, files: [] };
    }

    const listResult = await workspacePort.listFiles(folder.id);

    if (!listResult.ok) {
        throw new Error(listResult.error.message);
    }

    const files = toWorkspaceFiles(listResult.data.files);

    return { folder, files };
}
