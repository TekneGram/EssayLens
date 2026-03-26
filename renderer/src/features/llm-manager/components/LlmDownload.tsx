import type { DownloadProgressView, LlmCatalogModel, LlmDownloadedModel, LlmKey } from '../domain/llmManager.types';

interface LlmDownloadProps {
  catalogModels: LlmCatalogModel[];
  downloadedModels: LlmDownloadedModel[];
  supportsDownload: boolean;
  onDownload: (key: LlmKey) => Promise<unknown>;
  onDelete: (key: LlmKey) => Promise<unknown>;
  isDownloading: boolean;
  isDeleting: boolean;
  progressByKey: Partial<Record<LlmKey, DownloadProgressView>>;
  errorMessage?: string;
}

export function LlmDownload({
  catalogModels,
  downloadedModels,
  supportsDownload,
  onDownload,
  onDelete,
  isDownloading,
  isDeleting,
  progressByKey,
  errorMessage
}: LlmDownloadProps) {
  const downloadedKeys = new Set(downloadedModels.map((model) => model.key));

  return (
    <section className="subpane llm-panel" aria-label="LLM download manager" data-testid="llm-download">
      <h4>LlmDownload</h4>
      <div className="content-block llm-section-content">
        <ul className="llm-download-list" aria-label="Available models">
          {catalogModels.map((model) => {
            const isDownloaded = downloadedKeys.has(model.key);
            const progress = progressByKey[model.key]?.event;
            const isInProgress = Boolean(progress && (progress.phase === 'starting' || progress.phase === 'downloading' || progress.phase === 'persisting'));
            const showProgress = Boolean(progress) && !isDownloaded;
            const progressValue = progress?.percent ?? undefined;
            const progressMax = progress?.percent === null ? undefined : 100;
            return (
              <li key={model.key} className="llm-download-item">
                <div className="llm-download-meta">
                  <p className="llm-model-name">{model.displayName}</p>
                  <p className="llm-model-detail">{model.hfRepoId}</p>
                  <p className="llm-model-detail">{model.hfFilename}</p>
                  {showProgress ? (
                    <div className="llm-download-progress" aria-live="polite">
                      <p className="llm-model-detail llm-progress-status">{progress?.status}</p>
                      {progress?.percent === null ? (
                        <div className="llm-progress-indeterminate" role="progressbar" aria-label={`Downloading ${model.displayName}`} />
                      ) : (
                        <progress
                          className="llm-progress-bar"
                          max={progressMax}
                          value={progressValue}
                          aria-label={`Downloading ${model.displayName}`}
                        />
                      )}
                      <p className="llm-model-detail">
                        {progress?.percent === null
                          ? `${progress?.bytesReceived ?? 0} bytes`
                          : `${progress?.percent ?? 0}%`}
                      </p>
                      {progress?.errorMessage ? <p className="llm-inline-error">{progress.errorMessage}</p> : null}
                    </div>
                  ) : null}
                </div>
                <div className="llm-download-actions">
                  <button
                    type="button"
                    className="llm-action-button"
                    disabled={isDownloaded || isDownloading || isDeleting || isInProgress || !supportsDownload}
                    onClick={() => void onDownload(model.key)}
                    aria-label={`Download ${model.displayName}`}
                  >
                    {isDownloaded ? 'Downloaded' : isInProgress ? 'Downloading...' : supportsDownload ? 'Download' : 'Download unavailable'}
                  </button>
                  {isDownloaded ? (
                    <button
                      type="button"
                      className="llm-action-button llm-action-danger"
                      disabled={isDownloading || isDeleting || isInProgress}
                      aria-label={`Delete ${model.displayName}`}
                      onClick={() => {
                        const shouldDelete = window.confirm(`Delete ${model.displayName} from disk and database?`);
                        if (!shouldDelete) {
                          return;
                        }
                        void onDelete(model.key);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
        {errorMessage ? <p className="llm-inline-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
