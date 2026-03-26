import { useMutation } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch } from 'react';
import { usePorts } from '@/app/ports';
import type { AppAction } from '@/app/providers/state/actions';
import { useRubricDraftQuery } from '@/features/rubric-data';
import { buildScoreSelectionsFromCellKeys, handleClearAppliedSuccess, invalidateRubricQueries } from '../application/scoreTool.workflows';
import { hasDraftCells } from '../domain/scoreTool.logic';

interface UseScoreToolMutationsArgs {
  fileId: string | null;
  effectiveRubricId: string | null;
  draftData: ReturnType<typeof useRubricDraftQuery>['data'];
  dispatch: Dispatch<AppAction>;
  queryClient: QueryClient;
  onStartResetAfterClear: () => void;
}

export function useScoreToolMutations(args: UseScoreToolMutationsArgs) {
  const { rubric } = usePorts();

  const saveScoresMutation = useMutation({
    mutationFn: async (nextSelectedCellKeys: string[]) => {
      if (!args.fileId || !args.effectiveRubricId || !hasDraftCells(args.draftData)) {
        return;
      }

      const selections = buildScoreSelectionsFromCellKeys(args.draftData, nextSelectedCellKeys);
      if (selections.length === 0) {
        return;
      }

      const result = await rubric.saveFileScores({
        fileId: args.fileId,
        rubricId: args.effectiveRubricId,
        selections
      });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to save rubric scores.');
      }
    },
    onSuccess: async () => {
      if (!args.fileId || !args.effectiveRubricId) {
        return;
      }
      await invalidateRubricQueries({ queryClient: args.queryClient, fileId: args.fileId, rubricId: args.effectiveRubricId });
    }
  });

  const clearAppliedMutation = useMutation({
    mutationFn: async () => {
      if (!args.fileId || !args.effectiveRubricId) {
        return;
      }
      const result = await rubric.clearAppliedRubric({
        fileId: args.fileId,
        rubricId: args.effectiveRubricId
      });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to clear applied rubric.');
      }
    },
    onSuccess: async () => {
      if (!args.fileId) {
        return;
      }
      args.onStartResetAfterClear();
      await handleClearAppliedSuccess({
        queryClient: args.queryClient,
        dispatch: args.dispatch,
        fileId: args.fileId,
        clearedRubricId: args.effectiveRubricId
      });
    }
  });

  return {
    clearAppliedMutation,
    saveScoresMutation
  };
}
