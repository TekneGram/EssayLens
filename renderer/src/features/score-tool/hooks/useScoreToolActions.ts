import { useCallback } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from '@/app/providers/state/actions';
import { shouldApplySelectedCellChange } from '../application/scoreTool.workflows';
import { confirmRubricChange } from './confirmRubricChange';

interface UseScoreToolActionsArgs {
  fileId: string | null;
  effectiveRubricId: string | null;
  normalizedSelectedCellKeys: string;
  isResettingAfterRubricClear: boolean;
  clearAppliedPending: boolean;
  dispatch: Dispatch<AppAction>;
  onClearApplied: () => void;
  onSaveScores: (nextSelectedCellKeys: string[]) => void;
}

export function useScoreToolActions(args: UseScoreToolActionsArgs) {
  const {
    clearAppliedPending,
    dispatch,
    effectiveRubricId,
    fileId,
    isResettingAfterRubricClear,
    normalizedSelectedCellKeys,
    onClearApplied,
    onSaveScores
  } = args;

  const onRequestChangeRubric = useCallback(() => {
    if (!confirmRubricChange()) {
      return;
    }
    onClearApplied();
  }, [onClearApplied]);

  const onSelectRubric = useCallback(
    (rubricId: string) => {
      if (!fileId) {
        return;
      }
      dispatch({
        type: 'rubric/selectGradingForFile',
        payload: {
          fileId,
          rubricId
        }
      });
    },
    [dispatch, fileId]
  );

  const onSelectedCellKeysChange = useCallback(
    (nextSelectedCellKeys: string[]) => {
      if (!fileId || !effectiveRubricId) {
        return;
      }

      if (
        !shouldApplySelectedCellChange({
          clearAppliedPending,
          isResettingAfterRubricClear,
          nextSelectedCellKeys,
          normalizedSelectedCellKeys
        })
      ) {
        return;
      }

      dispatch({
        type: 'rubric/setGradingSelection',
        payload: {
          fileId,
          rubricId: effectiveRubricId,
          selectedCellKeys: nextSelectedCellKeys
        }
      });
      onSaveScores(nextSelectedCellKeys);
    },
    [clearAppliedPending, dispatch, effectiveRubricId, fileId, isResettingAfterRubricClear, normalizedSelectedCellKeys, onSaveScores]
  );

  return {
    onRequestChangeRubric,
    onSelectRubric,
    onSelectedCellKeysChange
  };
}
