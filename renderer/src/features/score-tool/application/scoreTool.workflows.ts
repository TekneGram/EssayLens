import type { QueryClient } from '@tanstack/react-query';
import type { Dispatch } from 'react';
import { rubricQueryKeys } from '@/features/rubric-data';
import type { RubricSourceData } from '@/features/rubric-tab/domain';
import { createCellKey } from '@/features/rubric-tab/domain';
import type { AppAction } from '@/app/providers/state/actions';
import { isTemporaryDetailId, normalizeCellKeyList } from '../domain/scoreTool.logic';

export function buildScoreSelectionsFromCellKeys(draftData: RubricSourceData, selectedCellKeys: string[]) {
  const scoreById = new Map(draftData.scores?.map((score) => [score.id, score.value]));
  const cellsByKey = new Map((draftData.cells ?? []).map((cell) => [createCellKey(cell.categoryId, cell.scoreId), cell]));

  return selectedCellKeys
    .map((key) => cellsByKey.get(key))
    .filter((cell): cell is NonNullable<typeof cell> => Boolean(cell?.detailId))
    .filter((cell) => !isTemporaryDetailId(cell.detailId))
    .map((cell) => ({
      rubricDetailId: cell.detailId as string,
      assignedScore: String(scoreById.get(cell.scoreId) ?? '')
    }))
    .filter((selection) => selection.assignedScore.trim().length > 0);
}

export function buildHydratedSelectionFromScores(args: {
  draftData: RubricSourceData;
  scores: Array<{ rubricDetailUuid: string }>;
}): string[] {
  const cellKeyByDetailId = new Map(
    (args.draftData.cells ?? [])
      .filter((cell) => Boolean(cell.detailId))
      .map((cell) => [cell.detailId as string, createCellKey(cell.categoryId, cell.scoreId)])
  );

  return args.scores
    .map((score) => cellKeyByDetailId.get(score.rubricDetailUuid))
    .filter((value): value is string => Boolean(value));
}

export async function invalidateRubricQueries(args: {
  queryClient: QueryClient;
  fileId: string;
  rubricId: string;
}) {
  await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.gradingContext(args.fileId) });
  await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.fileScores(args.fileId, args.rubricId) });
  await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
}

export async function handleClearAppliedSuccess(args: {
  queryClient: QueryClient;
  dispatch: Dispatch<AppAction>;
  fileId: string;
  clearedRubricId: string | null;
}) {
  args.queryClient.setQueryData(rubricQueryKeys.gradingContext(args.fileId), {
    fileId: args.fileId,
    lockedRubricId: undefined,
    selectedRubricIdForFile: undefined
  });

  if (args.clearedRubricId) {
    args.queryClient.setQueryData(rubricQueryKeys.fileScores(args.fileId, args.clearedRubricId), {
      instance: null,
      scores: []
    });
  }

  args.dispatch({ type: 'rubric/clearGradingSelection', payload: { fileId: args.fileId } });
  args.dispatch({ type: 'rubric/selectGradingForFile', payload: { fileId: args.fileId, rubricId: null } });
  args.dispatch({ type: 'rubric/setLockedGradingRubricId', payload: null });

  await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.gradingContext(args.fileId) });
  if (args.clearedRubricId) {
    await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.fileScores(args.fileId, args.clearedRubricId) });
  }
  await args.queryClient.invalidateQueries({ queryKey: rubricQueryKeys.list() });
}

export function shouldApplySelectedCellChange(args: {
  clearAppliedPending: boolean;
  isResettingAfterRubricClear: boolean;
  nextSelectedCellKeys: string[];
  normalizedSelectedCellKeys: string;
}): boolean {
  if (args.clearAppliedPending || args.isResettingAfterRubricClear) {
    return false;
  }

  const normalizedNext = normalizeCellKeyList(args.nextSelectedCellKeys);
  return normalizedNext !== args.normalizedSelectedCellKeys;
}
