import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports/../ports';
import { rubricQueryKeys } from '@/features/rubric-data/hooks/queryKeys';

export function useRubricListQuery() {
  const { rubric } = usePorts();

  const query = useQuery({
    queryKey: rubricQueryKeys.list(),
    queryFn: async () => {
      const result = await rubric.listRubrics();
      if (result.ok) {
        return result.data;
      }
      throw new Error(result.error.message || 'Unable to load rubrics.');
    }
  });

  return query;
}
