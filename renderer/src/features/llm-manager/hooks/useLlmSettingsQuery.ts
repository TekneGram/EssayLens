import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { getSettings } from '../application/llmManager.service';
import { llmManagerQueryKeys } from '../infrastructure/queryKeys';

export function useLlmSettingsQuery(enabled = true) {
  const { llmManager } = usePorts();

  return useQuery({
    queryKey: llmManagerQueryKeys.settings(),
    queryFn: async () => getSettings(llmManager),
    enabled
  });
}
