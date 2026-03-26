import { useQuery } from '@tanstack/react-query';
import { usePorts } from '@/app/ports';
import { useAppState } from '@/app/providers/state';
import { rubricQueryKeys, useRubricDraftQuery, useRubricListQuery } from '@/features/rubric-data';
import { normalizeCellKeyList, resolveEffectiveRubricId, resolvePreferredRubricId } from '../domain/scoreTool.logic';

export function useScoreToolData() {
  const { rubric } = usePorts();
  const state = useAppState();
  const fileId = state.workspace.selectedFile.fileId;
  const listQuery = useRubricListQuery();
  const gradingRubricId = fileId ? state.rubric.selectedGradingRubricIdByFileId[fileId] ?? null : null;
  const lockedGradingRubricId = state.rubric.lockedGradingRubricId;

  const gradingContextQuery = useQuery({
    queryKey: rubricQueryKeys.gradingContext(fileId ?? 'none'),
    enabled: Boolean(fileId),
    queryFn: async () => {
      if (!fileId) {
        return null;
      }
      const result = await rubric.getGradingContext({ fileId });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to load rubric grading context.');
      }

      return result.data;
    }
  });

  const lockedFromDb = gradingContextQuery.data?.lockedRubricId ?? null;
  const selectedFromDb = gradingContextQuery.data?.selectedRubricIdForFile ?? null;

  const preferredRubricId = resolvePreferredRubricId({
    lockedFromDb,
    gradingRubricId,
    selectedFromDb,
    lastUsedRubricId: listQuery.data?.lastUsedRubricId,
    firstRubricId: listQuery.data?.rubrics[0]?.entityUuid
  });

  const effectiveRubricId = resolveEffectiveRubricId({
    lockedFromDb,
    gradingRubricId,
    preferredRubricId
  });

  const draftQuery = useRubricDraftQuery(effectiveRubricId);

  const fileScoresQuery = useQuery({
    queryKey: rubricQueryKeys.fileScores(fileId ?? 'none', effectiveRubricId ?? 'none'),
    enabled: Boolean(fileId && effectiveRubricId),
    queryFn: async () => {
      if (!fileId || !effectiveRubricId) {
        return null;
      }
      const result = await rubric.getFileScores({ fileId, rubricId: effectiveRubricId });
      if (!result.ok) {
        throw new Error(result.error.message || 'Unable to load rubric scores.');
      }

      return result.data;
    }
  });

  const gradingSelection = fileId && effectiveRubricId ? state.rubric.gradingSelectionByFileId[fileId] : undefined;
  const selectedCellKeys = gradingSelection?.rubricId === effectiveRubricId ? gradingSelection.selectedCellKeys : [];
  const normalizedSelectedCellKeys = normalizeCellKeyList(selectedCellKeys);

  return {
    draftQuery,
    effectiveRubricId,
    fileId,
    fileScoresQuery,
    gradingContextQuery,
    gradingRubricId,
    listQuery,
    lockedFromDb,
    lockedGradingRubricId,
    normalizedSelectedCellKeys,
    selectedCellKeys
  };
}
