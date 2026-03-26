import { useMemo, useState } from 'react';
import type { LlmSettings } from '../domain/llmManager.types';
import {
  formatSettingValue,
  isBooleanSettingKey,
  isEditableSettingKey,
  parseSettingStringValue,
  type EditableValue,
  type SettingKey
} from '../domain/llmSettings.logic';

interface UseLlmSettingsEditorOptions {
  settings: LlmSettings | null;
  isSaving: boolean;
  onSave: (settings: Partial<LlmSettings>) => Promise<unknown>;
}

export function useLlmSettingsEditor({ settings, isSaving, onSave }: UseLlmSettingsEditorOptions) {
  const [editingKey, setEditingKey] = useState<SettingKey | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');
  const [draftBooleanValue, setDraftBooleanValue] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const settingKeys = useMemo(() => {
    if (!settings) {
      return [] as SettingKey[];
    }
    return Object.keys(settings).sort() as SettingKey[];
  }, [settings]);

  const beginEdit = (key: SettingKey) => {
    if (!settings || !isEditableSettingKey(key)) {
      return;
    }
    const currentValue = settings[key];
    setEditingKey(key);
    setLocalError(null);
    if (isBooleanSettingKey(key)) {
      setDraftBooleanValue(Boolean(currentValue));
      setDraftValue('');
      return;
    }
    setDraftValue(currentValue === null ? '' : String(currentValue));
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setDraftValue('');
    setLocalError(null);
  };

  const saveEdit = async () => {
    if (!settings || !editingKey) {
      return;
    }
    try {
      const nextValue: EditableValue = isBooleanSettingKey(editingKey)
        ? draftBooleanValue
        : parseSettingStringValue(editingKey, draftValue);
      await onSave({ [editingKey]: nextValue } as Partial<LlmSettings>);
      cancelEdit();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Could not save setting.');
    }
  };

  return {
    settingKeys,
    editingKey,
    draftValue,
    draftBooleanValue,
    localError,
    isSaving,
    isEditableSettingKey,
    isBooleanSettingKey,
    formatSettingValue,
    setDraftValue,
    setDraftBooleanValue,
    beginEdit,
    cancelEdit,
    saveEdit
  };
}
