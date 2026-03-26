import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { rubricForReactQueryKeys } from '@/features/rubric-for-react/infrastructure/queryKeys';
import type { RubricCommand } from '@/features/rubric-for-react/domain';

export function useRubricForReactMutations(rubricId: string | null) {
  const { rubric } = usePorts();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (operation: RubricCommand) => {
      if (!rubricId) {
        throw new Error('Select a rubric before updating it.');
      }
      const result = await rubric.updateMatrix({ rubricId, operation });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to update rubric.');
      }
    },
    onSuccess: async () => {
      if (!rubricId) {
        return;
      }
      await queryClient.invalidateQueries({ queryKey: rubricForReactQueryKeys.matrix(rubricId) });
      await queryClient.invalidateQueries({ queryKey: rubricForReactQueryKeys.list() });
    }
  });

  return {
    updateRubric: updateMutation.mutateAsync,
    isPending: updateMutation.isPending,
    errorMessage: updateMutation.error instanceof Error ? updateMutation.error.message : undefined
  };
}
