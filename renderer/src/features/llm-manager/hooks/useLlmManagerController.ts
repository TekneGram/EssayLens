import { useEffect, useState } from 'react';
import type { DownloadProgressView, LlmKey } from '../domain/llmManager.types';
import { useActiveLlmModelQuery } from './useActiveLlmModelQuery';
import { useDownloadedLlmModelsQuery } from './useDownloadedLlmModelsQuery';
import { useLlmCatalogQuery } from './useLlmCatalogQuery';
import { useLlmManagerMutations } from './useLlmManagerMutations';
import { useLlmSettingsQuery } from './useLlmSettingsQuery';
import { usePorts } from '@/app/ports';
import { subscribeToDownloadProgress } from '../application/llmManager.service';

export function useLlmManagerController() {
  const { llmManager } = usePorts();
  const hasLlmManagerApi = llmManager.isAvailable();
  const supportsDownload = llmManager.supportsDownload();

  const catalogQuery = useLlmCatalogQuery();
  const downloadedQuery = useDownloadedLlmModelsQuery(hasLlmManagerApi);
  const activeModelQuery = useActiveLlmModelQuery(hasLlmManagerApi);
  const settingsQuery = useLlmSettingsQuery(hasLlmManagerApi);
  const mutations = useLlmManagerMutations();

  const [progressByKey, setProgressByKey] = useState<Partial<Record<LlmKey, DownloadProgressView>>>({});

  useEffect(() => {
    const unsubscribe = subscribeToDownloadProgress(llmManager, (event) => {
      setProgressByKey((previous) => ({
        ...previous,
        [event.key]: { event }
      }));
    });
    return unsubscribe;
  }, [llmManager]);

  useEffect(() => {
    const downloadedModels = downloadedQuery.data ?? [];
    if (downloadedModels.length === 0) {
      return;
    }

    setProgressByKey((previous) => {
      const next = { ...previous };
      for (const downloaded of downloadedModels) {
        delete next[downloaded.key];
      }
      return next;
    });
  }, [downloadedQuery.data]);

  const listErrorMessage = [catalogQuery.error, downloadedQuery.error, activeModelQuery.error, settingsQuery.error]
    .filter((error): error is Error => error instanceof Error)
    .map((error) => error.message)
    .join(' ');

  return {
    hasLlmManagerApi,
    supportsDownload,
    catalogQuery,
    downloadedQuery,
    activeModelQuery,
    settingsQuery,
    mutations,
    progressByKey,
    listErrorMessage
  };
}
