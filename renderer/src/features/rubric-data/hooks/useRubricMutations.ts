import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePorts } from '@/app/ports/../ports';
import type { RubricCommand } from '@/features/rubric-for-react/domain';
import { rubricQueryKeys } from '@/features/rubric-data/hooks/queryKeys';

export function useRubricMutations(rubricId: string | null) {
  const { rubric } = usePorts();
  const queryClient = useQueryClient();

  const mutation = useMutation({
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
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.matrix(rubricId) });
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
    }
  });

  const setLastUsedMutation = useMutation({
    mutationFn: async (nextRubricId: string) => {
      const result = await rubric.setLastUsed({ rubricId: nextRubricId });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to set last used rubric.');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
    }
  });

  const createRubricMutation = useMutation<string, Error, string>({
    mutationFn: async (name = 'New Rubric') => {
      const result = await rubric.createRubric({ name });
      if (result.ok) {
        return result.data.rubricId;
      }
      throw new Error(result.error.message || 'Unable to create rubric.');
    },
    onSuccess: async (createdRubricId) => {
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.matrix(createdRubricId) });
    }
  });

  const cloneRubricMutation = useMutation<string, Error, string>({
    mutationFn: async (sourceRubricId) => {
      const result = await rubric.cloneRubric({ rubricId: sourceRubricId });
      if (result.ok) {
        return result.data.rubricId;
      }
      throw new Error(result.error.message || 'Unable to clone rubric.');
    },
    onSuccess: async (clonedRubricId) => {
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.matrix(clonedRubricId) });
    }
  });

  const deleteRubricMutation = useMutation<void, Error, string>({
    mutationFn: async (rubricIdToDelete) => {
      const result = await rubric.deleteRubric({ rubricId: rubricIdToDelete });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to delete rubric.');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
      if (rubricId) {
        await queryClient.invalidateQueries({ queryKey: rubricQueryKeys.matrix(rubricId) });
      }
    }
  });

  return {
    updateRubric: mutation.mutateAsync,
    setLastUsed: setLastUsedMutation.mutateAsync,
    createRubric: createRubricMutation.mutateAsync,
    cloneRubric: cloneRubricMutation.mutateAsync,
    deleteRubric: deleteRubricMutation.mutateAsync,
    isPending: mutation.isPending,
    errorMessage: mutation.error instanceof Error ? mutation.error.message : undefined
  };
}
