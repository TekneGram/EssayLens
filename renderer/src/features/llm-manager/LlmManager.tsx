import { LlmConfiguration } from './components/LlmConfiguration';
import { LlmDownload } from './components/LlmDownload';
import { LlmSelector } from './components/LlmSelector';
import { useLlmManagerController } from './hooks/useLlmManagerController';
import './styles/llm-manager.css';

export function LlmManager() {
  const {
    supportsDownload,
    catalogQuery,
    downloadedQuery,
    activeModelQuery,
    settingsQuery,
    mutations,
    progressByKey,
    listErrorMessage
  } = useLlmManagerController();
  const catalogModels = catalogQuery.data ?? [];
  const downloadedModels = downloadedQuery.data ?? [];
  const activeModel = activeModelQuery.data ?? null;
  const settings = settingsQuery.data ?? null;

  return (
    <div className="llm-manager" data-testid="llm-manager">
      {listErrorMessage ? <p className="llm-inline-error">{listErrorMessage}</p> : null}
      <div className="llm-manager-grid">
        <LlmDownload
          catalogModels={catalogModels}
          downloadedModels={downloadedModels}
          supportsDownload={supportsDownload}
          onDownload={mutations.downloadModel}
          onDelete={mutations.deleteModel}
          isDownloading={mutations.isDownloading}
          isDeleting={mutations.isDeleting}
          progressByKey={progressByKey}
          errorMessage={mutations.downloadError ?? mutations.deleteError}
        />
        <LlmSelector
          downloadedModels={downloadedModels}
          activeModelKey={activeModel?.key ?? null}
          isSelecting={mutations.isSelecting}
          onSelect={mutations.selectModel}
          errorMessage={mutations.selectError}
        />
        <LlmConfiguration
          settings={settings}
          canResetDefaults={Boolean(activeModel)}
          isSaving={mutations.isSavingSettings}
          isResetting={mutations.isResettingSettings}
          onSave={mutations.updateSettings}
          onResetDefaults={mutations.resetSettingsToDefaults}
          errorMessage={mutations.settingsError}
        />
      </div>
    </div>
  );
}
