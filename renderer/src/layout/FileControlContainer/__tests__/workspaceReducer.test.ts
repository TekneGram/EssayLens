import { describe, expect, it } from 'vitest';
import { initialWorkspaceState, workspaceReducer } from '@/layout/FileControlContainer/state/workspace.reducer';

describe('workspaceReducer', () => {
    it('sets current folder', () => {
        const next = workspaceReducer(initialWorkspaceState, {
            type: 'workspace/setFolder',
            payload: { id: 'folder-1', name: 'Essays', path: '/tmp/essays' }
        });

        expect(next.currentFolder?.id).toBe('folder-1');
        expect(initialWorkspaceState.currentFolder).toBeNull();
    });

    it('sets selected file without mutating previous state', () => {
        const state = initialWorkspaceState;
        const next = workspaceReducer(state, {
            type: 'workspace/setSelectedFile',
            payload: { fileId: 'fileB', status: 'ready' }
        });

        expect(next.selectedFile.fileId).toBe('fileB');
        expect(state.selectedFile.fileId).toBeNull();
    });
});
