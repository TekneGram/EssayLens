import type { SelectedFileState, WorkspaceFile, WorkspaceFolder, WorkspaceState } from '@/layout/FileControlContainer/domain/workspace.types';

export type WorkspaceAction =
    | { type: 'workspace/setFolder'; payload: WorkspaceFolder | null }
    | { type: 'workspace/setFiles'; payload: WorkspaceFile[] }
    | { type: 'workspace/setStatus'; payload: WorkspaceState['status'] }
    | { type: 'workspace/setError'; payload?: string }
    | { type: 'workspace/setSelectedFile'; payload: SelectedFileState };
