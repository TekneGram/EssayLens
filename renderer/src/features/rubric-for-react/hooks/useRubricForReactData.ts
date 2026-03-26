import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { matrixToRubricSourceData } from '@/features/rubric-data/domain/rubricMatrixMapper';
import { rubricForReactQueryKeys } from '@/features/rubric-for-react/infrastructure/queryKeys';

export function useRubricForReactData(rubricId: string | null, enabled = true) {
  const { rubric } = usePorts();

  return useQuery({
    queryKey: rubricForReactQueryKeys.matrix(rubricId ?? 'none'),
    enabled: Boolean(rubricId) && enabled,
    queryFn: async () => {
      if (!rubricId) {
        return null;
      }
      const result = await rubric.getMatrix({ rubricId });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to load rubric.');
      }
      return matrixToRubricSourceData(result.data);
    }
  });
}
