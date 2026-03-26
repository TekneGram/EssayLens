import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useReducer } from 'react';
import { useAppDispatch } from '@/app/providers/state';
import { useRubricDraftQuery } from '@/features/rubric-data';
import { findAppliedRubricName, hasDraftCells, hasRubricsList } from '../domain/scoreTool.logic';
import { initialScoreToolState, scoreToolReducer } from '../state/scoreTool.state';
import { useScoreToolActions } from './useScoreToolActions';
import { useScoreToolData } from './useScoreToolData';
import { useScoreToolHydration } from './useScoreToolHydration';
import { useScoreToolLifecycle } from './useScoreToolLifecycle';
import { useScoreToolMutations } from './useScoreToolMutations';

export type ScoreToolViewModel =
  | {
      kind: 'message';
      message: string;
    }
  | {
      kind: 'ready';
      lockedFromDb: string | null;
      effectiveRubricId: string;
      appliedRubricName: string | null;
      rubrics: Array<{ entityUuid: string; name: string }>;
      draftData: NonNullable<ReturnType<typeof useRubricDraftQuery>['data']>;
      selectedCellKeys: string[];
      isChangingRubric: boolean;
      onRequestChangeRubric: () => void;
      onSelectRubric: (rubricId: string) => void;
      onSelectedCellKeysChange: (nextSelectedCellKeys: string[]) => void;
    };

export function useScoreToolController(): ScoreToolViewModel {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [localState, localDispatch] = useReducer(scoreToolReducer, initialScoreToolState);
  const data = useScoreToolData();
  const onStartResetAfterClear = useCallback(() => {
    localDispatch({ type: 'scoreTool/startResetAfterClear' });
  }, []);
  const onFinishResetAfterClear = useCallback(() => {
    localDispatch({ type: 'scoreTool/finishResetAfterClear' });
  }, []);
  const mutations = useScoreToolMutations({
    fileId: data.fileId,
    effectiveRubricId: data.effectiveRubricId,
    draftData: data.draftQuery.data,
    dispatch,
    queryClient,
    onStartResetAfterClear
  });

  useScoreToolLifecycle({
    fileId: data.fileId,
    gradingRubricId: data.gradingRubricId,
    effectiveRubricId: data.effectiveRubricId,
    lockedFromDb: data.lockedFromDb,
    lockedGradingRubricId: data.lockedGradingRubricId,
    normalizedSelectedCellKeys: data.normalizedSelectedCellKeys,
    savedScoresCount: data.fileScoresQuery.data?.scores.length ?? 0,
    isResettingAfterRubricClear: localState.isResettingAfterRubricClear,
    dispatch,
    onFinishResetAfterClear
  });

  useScoreToolHydration({
    fileId: data.fileId,
    effectiveRubricId: data.effectiveRubricId,
    draftData: data.draftQuery.data,
    scores: data.fileScoresQuery.data?.scores,
    normalizedSelectedCellKeys: data.normalizedSelectedCellKeys,
    dispatch
  });

  const { onRequestChangeRubric, onSelectRubric, onSelectedCellKeysChange } = useScoreToolActions({
    fileId: data.fileId,
    effectiveRubricId: data.effectiveRubricId,
    normalizedSelectedCellKeys: data.normalizedSelectedCellKeys,
    isResettingAfterRubricClear: localState.isResettingAfterRubricClear,
    clearAppliedPending: mutations.clearAppliedMutation.isPending,
    dispatch,
    onClearApplied: () => {
      mutations.clearAppliedMutation.mutate();
    },
    onSaveScores: (nextSelectedCellKeys) => {
      mutations.saveScoresMutation.mutate(nextSelectedCellKeys);
    }
  });

  if (!data.fileId) {
    return { kind: 'message', message: 'Select a file before scoring.' };
  }

  if (data.listQuery.isPending || data.gradingContextQuery.isPending || data.fileScoresQuery.isPending) {
    return { kind: 'message', message: 'Loading rubrics...' };
  }

  if (data.listQuery.isError || data.gradingContextQuery.isError || data.fileScoresQuery.isError) {
    return { kind: 'message', message: 'Unable to load rubrics for scoring.' };
  }

  if (!hasRubricsList(data.listQuery.data)) {
    return { kind: 'message', message: 'No rubrics are available for scoring.' };
  }

  if (!data.effectiveRubricId || data.draftQuery.isPending) {
    return { kind: 'message', message: 'Loading rubric...' };
  }

  if (data.draftQuery.isError || !hasDraftCells(data.draftQuery.data)) {
    return { kind: 'message', message: 'Unable to load rubric for scoring.' };
  }

  return {
    kind: 'ready',
    lockedFromDb: data.lockedFromDb,
    effectiveRubricId: data.effectiveRubricId,
    appliedRubricName: findAppliedRubricName(data.listQuery.data, data.effectiveRubricId),
    rubrics: data.listQuery.data.rubrics,
    draftData: data.draftQuery.data,
    selectedCellKeys: data.selectedCellKeys,
    isChangingRubric: mutations.clearAppliedMutation.isPending,
    onRequestChangeRubric,
    onSelectRubric,
    onSelectedCellKeysChange
  };
}
