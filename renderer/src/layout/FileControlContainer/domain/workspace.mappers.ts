import type { SelectFolderResponse, WorkspaceFileDto } from '@/app/ports/workspace.port';
import { fileKindFromExtension } from '@/layout/FileControlContainer/domain/fileKind';
import type { WorkspaceFile, WorkspaceFolder } from '@/layout/FileControlContainer/domain/workspace.types';

export function toWorkspaceFolder(folder: SelectFolderResponse['folder']): WorkspaceFolder | null {
    if (!folder) {
        return null;
    }

    return {
        id: folder.id,
        path: folder.path,
        name: folder.name
    };
}

export function toWorkspaceFiles(files: WorkspaceFileDto[]): WorkspaceFile[] {
    return files.map((file) => ({
        id: file.id,
        folderId: file.folderId,
        name: file.name,
        path: file.path,
        kind: fileKindFromExtension(file.kind)
    }));
}
