interface LoaderBarProps {
    isLoading: boolean;
    onSelectFolder: () => void;
}

export function LoaderBar({ isLoading, onSelectFolder }: LoaderBarProps) {
    return (
        <aside className="loader-bar pane lb" data-testid="loader-bar" aria-label="Loader bar">
            <button
                type="button"
                className="lb-trigger"
                onClick={onSelectFolder}
                disabled={isLoading}
                aria-label={isLoading ? 'Selecting folder' : 'Select Folder'}
            >
                <span className="lb-stack">
                    <span className="lb-icon" aria-hidden="true" />
                    <span className="lb-label">{isLoading ? 'Selecting...' : 'Select Folder'}</span>
                </span>
            </button>
        </aside>
    );
}
