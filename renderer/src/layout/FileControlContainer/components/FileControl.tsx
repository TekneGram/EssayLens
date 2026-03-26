import { FileDisplayBar } from '@/layout/FileControlContainer/components/FileDisplayBar';
import { LoaderBar } from '@/layout/FileControlContainer/components/LoaderBar';
import type { WorkspaceFile } from '@/layout/FileControlContainer/domain/workspace.types';

interface FileControlProps {
    files: WorkspaceFile[];
    selectedFileId: string | null;
    isLoading: boolean;
    onSelectFolder: () => void;
    onSelectFile: (file: WorkspaceFile) => void;
}

export function FileControl({ files, selectedFileId, isLoading, onSelectFolder, onSelectFile }: FileControlProps) {
    return (
        <>
            <LoaderBar isLoading={isLoading} onSelectFolder={onSelectFolder} />
            <FileDisplayBar files={files} selectedFileId={selectedFileId} onSelectFile={onSelectFile} />
        </>
    );
}
