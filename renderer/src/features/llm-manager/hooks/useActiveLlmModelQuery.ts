import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { getActiveModel } from '../application/llmManager.service';
import { llmManagerQueryKeys } from '../infrastructure/queryKeys';

export function useActiveLlmModelQuery(enabled = true) {
  const { llmManager } = usePorts();

  return useQuery({
    queryKey: llmManagerQueryKeys.activeModel(),
    queryFn: async () => getActiveModel(llmManager),
    enabled
  });
}
