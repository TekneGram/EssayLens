import { useAppDispatch, useAppState } from '@/app/providers/state';
import { usePorts } from '@/app/ports';
import type { WorkspaceFile } from '@/layout/FileControlContainer/domain/workspace.types';
import { useSelectFolder } from '@/layout/FileControlContainer/hooks/useSelectFolder';

interface UseFileControlResult {
    files: WorkspaceFile[];
    selectedFileId: string | null;
    isLoading: boolean;
    pickFolder: () => Promise<void>;
    selectFile: (file: WorkspaceFile) => void;
}

export function useFileControl(): UseFileControlResult {
    const dispatch = useAppDispatch();
    const state = useAppState();
    const { workspace } = usePorts();
    const selectFolderMutation = useSelectFolder(dispatch, workspace);

    return {
        files: state.workspace.files,
        selectedFileId: state.workspace.selectedFile.fileId,
        isLoading: selectFolderMutation.isPending || state.workspace.status === 'loading',
        pickFolder: async () => {
            try {
                await selectFolderMutation.mutateAsync();
            } catch {
                // The mutation handles state + toast updates in onError.
            }
        },
        selectFile: (file) => {
            dispatch({ type: 'workspace/setSelectedFile', payload: { fileId: file.id, status: 'ready' } });
            dispatch({
                type: 'chat/addMessage',
                payload: {
                    id: `system-${file.id}-${Date.now()}`,
                    role: 'system',
                    content: `Selected file: ${file.name}`,
                    relatedFileId: file.id,
                    createdAt: new Date().toISOString()
                }
            });
        }
    };
}
