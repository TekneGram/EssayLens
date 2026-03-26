import type { LlmDownloadedModel, LlmKey } from '../domain/llmManager.types';

interface LlmSelectorProps {
  downloadedModels: LlmDownloadedModel[];
  activeModelKey: LlmKey | null;
  isSelecting: boolean;
  onSelect: (key: LlmKey) => Promise<unknown>;
  errorMessage?: string;
}

export function LlmSelector({ downloadedModels, activeModelKey, isSelecting, onSelect, errorMessage }: LlmSelectorProps) {
  const hasDownloadedModels = downloadedModels.length > 0;

  return (
    <section className="subpane llm-panel" aria-label="LLM selector" data-testid="llm-selector">
      <h4>LlmSelector</h4>
      <div className="content-block llm-section-content">
        <label className="llm-field-label" htmlFor="llm-selector-input">
          Active model
        </label>
        <select
          id="llm-selector-input"
          data-testid="llm-selector-input"
          className="llm-select"
          aria-label="Choose active model"
          disabled={!hasDownloadedModels || isSelecting}
          value={activeModelKey ?? ''}
          onChange={(event) => {
            const key = event.target.value as LlmKey;
            if (!key) {
              return;
            }
            void onSelect(key);
          }}
        >
          <option value="">{hasDownloadedModels ? 'Select a downloaded model' : 'No downloaded models available'}</option>
          {downloadedModels.map((model) => (
            <option key={model.key} value={model.key}>
              {model.displayName}
            </option>
          ))}
        </select>
        {errorMessage ? <p className="llm-inline-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
