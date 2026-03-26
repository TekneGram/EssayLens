import { useLlmSettingsEditor } from '../hooks/useLlmSettingsEditor';
import type { LlmSettings } from '../domain/llmManager.types';

interface LlmConfigurationProps {
  settings: LlmSettings | null;
  canResetDefaults: boolean;
  isSaving: boolean;
  isResetting: boolean;
  onSave: (settings: Partial<LlmSettings>) => Promise<unknown>;
  onResetDefaults: () => Promise<unknown>;
  errorMessage?: string;
}

export function LlmConfiguration({
  settings,
  canResetDefaults,
  isSaving,
  isResetting,
  onSave,
  onResetDefaults,
  errorMessage
}: LlmConfigurationProps) {
  const {
    settingKeys,
    editingKey,
    draftValue,
    draftBooleanValue,
    localError,
    isEditableSettingKey,
    isBooleanSettingKey,
    formatSettingValue,
    setDraftValue,
    setDraftBooleanValue,
    beginEdit,
    cancelEdit,
    saveEdit
  } = useLlmSettingsEditor({ settings, isSaving, onSave });

  return (
    <section className="subpane llm-panel" aria-label="LLM runtime configuration" data-testid="llm-configuration">
      <div className="llm-config-header">
        <h4>LlmConfiguration</h4>
        <button
          type="button"
          className="llm-action-button"
          onClick={() => void onResetDefaults()}
          disabled={!canResetDefaults || isResetting}
        >
          Reset defaults
        </button>
      </div>
      <div className="content-block llm-section-content">
        {!settings ? (
          <p className="llm-placeholder">LLM settings unavailable.</p>
        ) : (
          <table className="llm-config-table">
            <tbody>
              {settingKeys.map((key) => {
                const value = settings[key];
                const isEditing = editingKey === key;
                const isBoolean = isBooleanSettingKey(key);
                const isEditable = isEditableSettingKey(key);

                return (
                  <tr key={key}>
                    <th scope="row">{key}</th>
                    <td>
                      {isEditing && isEditable ? (
                        <div className="llm-config-editor">
                          {isBoolean ? (
                            <label className="llm-checkbox-field">
                              <input
                                type="checkbox"
                                checked={draftBooleanValue}
                                onChange={(event) => setDraftBooleanValue(event.target.checked)}
                              />
                              <span>{draftBooleanValue ? 'true' : 'false'}</span>
                            </label>
                          ) : (
                            <input
                              type="text"
                              value={draftValue}
                              onChange={(event) => setDraftValue(event.target.value)}
                              aria-label={`Value for ${key}`}
                            />
                          )}
                          <div className="llm-config-editor-actions">
                            <button type="button" className="llm-action-button" onClick={() => void saveEdit()} disabled={isSaving}>
                              Save
                            </button>
                            <button type="button" className="llm-action-button" onClick={cancelEdit} disabled={isSaving}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {isEditable ? (
                            <button
                              type="button"
                              className="llm-config-value-button"
                              onClick={() => beginEdit(key)}
                              aria-label={`Edit setting ${key}`}
                            >
                              {formatSettingValue(value)}
                            </button>
                          ) : (
                            <span className="llm-config-value-text">{formatSettingValue(value)}</span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {localError ? <p className="llm-inline-error">{localError}</p> : null}
        {errorMessage ? <p className="llm-inline-error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
