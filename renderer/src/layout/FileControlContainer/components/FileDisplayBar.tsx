import type { WorkspaceFile } from '@/layout/FileControlContainer/domain/workspace.types';

interface FileDisplayBarProps {
    files: WorkspaceFile[];
    selectedFileId: string | null;
    onSelectFile: (file: WorkspaceFile) => void;
}

export function FileDisplayBar({ files, selectedFileId, onSelectFile }: FileDisplayBarProps) {
    return (
        <aside className="file-display-bar pane fdb" data-testid="file-display-bar" aria-label="File display bar">
            <h3>FileDisplayBar</h3>
            <div className="file-list">
                <ul className="file-names">
                    {files.length > 0 ? (
                        files.map((file) => (
                            <li key={file.id}>
                                <button
                                    type="button"
                                    className="file-name"
                                    aria-current={selectedFileId === file.id}
                                    onClick={() => onSelectFile(file)}
                                >
                                    {file.name}
                                </button>
                            </li>
                        ))
                    ) : (
                        <li className="file-name-empty">No files selected.</li>
                    )}
                </ul>
            </div>
        </aside>
    );
}
