import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from '@/app/providers/state/actions';
import { shouldFinishReset } from '../domain/scoreTool.logic';

interface UseScoreToolLifecycleArgs {
  fileId: string | null;
  gradingRubricId: string | null;
  effectiveRubricId: string | null;
  lockedFromDb: string | null;
  lockedGradingRubricId: string | null;
  normalizedSelectedCellKeys: string;
  savedScoresCount: number;
  isResettingAfterRubricClear: boolean;
  dispatch: Dispatch<AppAction>;
  onFinishResetAfterClear: () => void;
}

export function useScoreToolLifecycle(args: UseScoreToolLifecycleArgs) {
  useEffect(() => {
    if (
      shouldFinishReset({
        isResettingAfterRubricClear: args.isResettingAfterRubricClear,
        lockedFromDb: args.lockedFromDb,
        normalizedSelectedCellKeys: args.normalizedSelectedCellKeys,
        savedScoresCount: args.savedScoresCount
      })
    ) {
      args.onFinishResetAfterClear();
    }
  }, [
    args.isResettingAfterRubricClear,
    args.lockedFromDb,
    args.normalizedSelectedCellKeys,
    args.onFinishResetAfterClear,
    args.savedScoresCount
  ]);

  useEffect(() => {
    if (!args.fileId) {
      return;
    }
    if (args.lockedGradingRubricId !== args.lockedFromDb) {
      args.dispatch({ type: 'rubric/setLockedGradingRubricId', payload: args.lockedFromDb });
    }
  }, [args.dispatch, args.fileId, args.lockedFromDb, args.lockedGradingRubricId]);

  useEffect(() => {
    if (!args.fileId || !args.effectiveRubricId) {
      return;
    }
    if (args.effectiveRubricId === args.gradingRubricId) {
      return;
    }
    args.dispatch({ type: 'rubric/selectGradingForFile', payload: { fileId: args.fileId, rubricId: args.effectiveRubricId } });
  }, [args.dispatch, args.effectiveRubricId, args.fileId, args.gradingRubricId]);
}
