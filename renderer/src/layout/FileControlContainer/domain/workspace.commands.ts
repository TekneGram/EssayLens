import type { EntityId } from '@/app/types/primitives';

export interface SelectFolderCommand {
    path: string;
}

export interface SelectFileCommand {
    fileId: EntityId;
}
