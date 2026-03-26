import type { EntityId, ISODateString } from '@/app/types/primitives';

export type FileKind =
    | 'docx'
    | 'pdf'
    | 'jpeg'
    | 'jpg'
    | 'png'
    | 'gif'
    | 'webp'
    | 'bmp'
    | 'svg'
    | 'heic'
    | 'heif'
    | 'avif'
    | 'tiff'
    | 'tif'
    | 'unknown';

export interface WorkspaceFolder {
    id: EntityId;
    path: string;
    name: string;
    selectedAt?: ISODateString;
}

export interface WorkspaceFile {
    id: EntityId;
    folderId: EntityId;
    name: string;
    path: string;
    kind: FileKind;
    imagePath?: string;
    createdAt?: ISODateString;
    updatedAt?: ISODateString;
}

export interface SelectedFileState {
    fileId: EntityId | null;
    status: 'idle' | 'loading' | 'ready' | 'error';
    error?: string;
}

export interface WorkspaceState {
    currentFolder: WorkspaceFolder | null;
    files: WorkspaceFile[];
    status: 'idle' | 'loading' | 'error';
    error?: string;
    selectedFile: SelectedFileState;
}
