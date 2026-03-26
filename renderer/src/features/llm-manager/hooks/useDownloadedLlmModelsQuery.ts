import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { listDownloadedModels } from '../application/llmManager.service';
import { llmManagerQueryKeys } from '../infrastructure/queryKeys';

export function useDownloadedLlmModelsQuery(enabled = true) {
  const { llmManager } = usePorts();

  return useQuery({
    queryKey: llmManagerQueryKeys.downloaded(),
    queryFn: async () => listDownloadedModels(llmManager),
    enabled
  });
}
