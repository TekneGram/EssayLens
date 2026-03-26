import { useMutation } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import type { Dispatch } from 'react';
import type { AppAction } from '@/app/providers/state';
import type { WorkspacePort } from '@/app/ports';
import { selectWorkspaceFolder } from '@/layout/FileControlContainer/application/workspace.service';

export function useSelectFolder(dispatch: Dispatch<AppAction>, workspacePort: WorkspacePort) {
    return useMutation({
        mutationFn: async () => selectWorkspaceFolder(workspacePort),

        onMutate: () => {
            dispatch({ type: 'workspace/setStatus', payload: 'loading' });
            dispatch({ type: 'workspace/setError', payload: undefined });
        },

        onSuccess: ({ folder, files }) => {
            dispatch({ type: 'workspace/setFolder', payload: folder });
            dispatch({ type: 'workspace/setFiles', payload: files });
            dispatch({ type: 'workspace/setSelectedFile', payload: { fileId: null, status: 'idle' } });
            dispatch({ type: 'workspace/setStatus', payload: 'idle' });
        },

        onError: (error: unknown) => {
            const message = error instanceof Error ? error.message : 'Could not select folder.';
            dispatch({ type: 'workspace/setStatus', payload: 'error' });
            dispatch({ type: 'workspace/setError', payload: message });
            toast.error(message);
        }
    });
}
