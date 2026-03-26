import { useEffect } from 'react';
import type { Dispatch } from 'react';
import type { AppAction } from '@/app/providers/state/actions';
import { useRubricDraftQuery } from '@/features/rubric-data';
import { buildHydratedSelectionFromScores } from '../application/scoreTool.workflows';
import { hasDraftCells, normalizeCellKeyList } from '../domain/scoreTool.logic';

interface UseScoreToolHydrationArgs {
  fileId: string | null;
  effectiveRubricId: string | null;
  draftData: ReturnType<typeof useRubricDraftQuery>['data'];
  scores: Array<{ rubricDetailUuid: string }> | undefined;
  normalizedSelectedCellKeys: string;
  dispatch: Dispatch<AppAction>;
}

export function useScoreToolHydration(args: UseScoreToolHydrationArgs) {
  useEffect(() => {
    if (!args.fileId || !args.effectiveRubricId || !hasDraftCells(args.draftData) || !args.scores) {
      return;
    }

    const hydratedSelection = buildHydratedSelectionFromScores({
      draftData: args.draftData,
      scores: args.scores
    });
    const normalizedHydrated = normalizeCellKeyList(hydratedSelection);

    if (normalizedHydrated === args.normalizedSelectedCellKeys) {
      return;
    }

    args.dispatch({
      type: 'rubric/setGradingSelection',
      payload: {
        fileId: args.fileId,
        rubricId: args.effectiveRubricId,
        selectedCellKeys: hydratedSelection
      }
    });
  }, [args.dispatch, args.draftData, args.effectiveRubricId, args.fileId, args.normalizedSelectedCellKeys, args.scores]);
}
