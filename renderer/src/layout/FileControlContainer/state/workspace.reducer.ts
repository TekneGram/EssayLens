import type { WorkspaceAction } from '@/layout/FileControlContainer/state/workspace.actions';
import type { WorkspaceState } from '@/layout/FileControlContainer/domain/workspace.types';
import type { AppAction } from '@/app/providers/state';

export const initialWorkspaceState: WorkspaceState = {
    currentFolder: null,
    files: [],
    status: 'idle',
    selectedFile: {
        fileId: null,
        status: 'idle'
    }
};

export function workspaceReducer(
    state: WorkspaceState = initialWorkspaceState,
    action: WorkspaceAction | AppAction
): WorkspaceState {
    switch (action.type) {
        case 'workspace/setFolder':
            return {
                ...state,
                currentFolder: action.payload
            };
        case 'workspace/setFiles':
            return {
                ...state,
                files: action.payload
            };
        case 'workspace/setStatus':
            return {
                ...state,
                status: action.payload
            };
        case 'workspace/setError':
            return {
                ...state,
                error: action.payload
            };
        case 'workspace/setSelectedFile':
            return {
                ...state,
                selectedFile: action.payload
            };
        default:
            return state;
    }
}
