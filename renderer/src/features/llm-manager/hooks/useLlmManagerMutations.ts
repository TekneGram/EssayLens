import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DownloadedLlmModelDto, LlmModelKey, LlmRuntimeSettings } from '@/app/ports/llmManager.port';
import { usePorts } from '@/app/ports';
import {
  deleteDownloadedModel,
  downloadModel,
  resetSettingsToDefaults,
  selectModel,
  updateSettings
} from '../application/llmManager.service';
import { llmManagerQueryKeys } from '../infrastructure/queryKeys';

export function useLlmManagerMutations() {
  const queryClient = useQueryClient();
  const { llmManager } = usePorts();

  const downloadMutation = useMutation({
    mutationFn: async (key: LlmModelKey): Promise<DownloadedLlmModelDto> => downloadModel(llmManager, key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.downloaded() });
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.activeModel() });
    }
  });

  const selectMutation = useMutation({
    mutationFn: async (key: LlmModelKey) => selectModel(llmManager, key),
    onSuccess: async (data) => {
      queryClient.setQueryData(llmManagerQueryKeys.activeModel(), data.activeModel);
      queryClient.setQueryData(llmManagerQueryKeys.settings(), data.settings);
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.downloaded() });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: LlmModelKey) => deleteDownloadedModel(llmManager, key),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.downloaded() });
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.activeModel() });
      await queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.settings() });
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (settings: Partial<LlmRuntimeSettings>) => updateSettings(llmManager, settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(llmManagerQueryKeys.settings(), settings);
    }
  });

  const resetSettingsMutation = useMutation({
    mutationFn: async () => resetSettingsToDefaults(llmManager),
    onSuccess: (data) => {
      queryClient.setQueryData(llmManagerQueryKeys.activeModel(), data.activeModel);
      queryClient.setQueryData(llmManagerQueryKeys.settings(), data.settings);
      queryClient.invalidateQueries({ queryKey: llmManagerQueryKeys.downloaded() });
    }
  });

  return {
    downloadModel: downloadMutation.mutateAsync,
    deleteModel: deleteMutation.mutateAsync,
    selectModel: selectMutation.mutateAsync,
    updateSettings: updateSettingsMutation.mutateAsync,
    resetSettingsToDefaults: resetSettingsMutation.mutateAsync,
    isDownloading: downloadMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isSelecting: selectMutation.isPending,
    isSavingSettings: updateSettingsMutation.isPending,
    isResettingSettings: resetSettingsMutation.isPending,
    downloadError: downloadMutation.error instanceof Error ? downloadMutation.error.message : undefined,
    deleteError: deleteMutation.error instanceof Error ? deleteMutation.error.message : undefined,
    selectError: selectMutation.error instanceof Error ? selectMutation.error.message : undefined,
    settingsError:
      updateSettingsMutation.error instanceof Error
        ? updateSettingsMutation.error.message
        : resetSettingsMutation.error instanceof Error
          ? resetSettingsMutation.error.message
          : undefined
  };
}
