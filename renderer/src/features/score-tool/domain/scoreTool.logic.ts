import type { RubricSourceData } from '@/features/rubric-tab/domain';

export function normalizeCellKeyList(keys: string[]): string {
  return [...keys].sort().join('||');
}

export function resolvePreferredRubricId(args: {
  lockedFromDb: string | null;
  gradingRubricId: string | null;
  selectedFromDb: string | null;
  lastUsedRubricId?: string;
  firstRubricId?: string;
}): string | null {
  return args.lockedFromDb ?? args.gradingRubricId ?? args.selectedFromDb ?? args.lastUsedRubricId ?? args.firstRubricId ?? null;
}

export function resolveEffectiveRubricId(args: {
  lockedFromDb: string | null;
  gradingRubricId: string | null;
  preferredRubricId: string | null;
}): string | null {
  return args.lockedFromDb ?? args.gradingRubricId ?? args.preferredRubricId;
}

export function shouldFinishReset(args: {
  isResettingAfterRubricClear: boolean;
  lockedFromDb: string | null;
  normalizedSelectedCellKeys: string;
  savedScoresCount: number;
}): boolean {
  if (!args.isResettingAfterRubricClear) {
    return false;
  }
  const hasLockedRubric = Boolean(args.lockedFromDb);
  const hasSelectedCells = args.normalizedSelectedCellKeys.length > 0;
  const hasSavedScores = args.savedScoresCount > 0;
  return !hasLockedRubric && !hasSelectedCells && !hasSavedScores;
}

export function isTemporaryDetailId(detailId: string | undefined): boolean {
  if (!detailId) {
    return true;
  }
  return detailId.startsWith('temp_') || detailId.startsWith('temp:');
}

export function findAppliedRubricName(listData: { rubrics: Array<{ entityUuid: string; name: string }> }, rubricId: string): string | null {
  return listData.rubrics.find((rubric) => rubric.entityUuid === rubricId)?.name ?? null;
}

export function hasRubricsList(listData: { rubrics: unknown[] } | undefined): boolean {
  return Boolean(listData && listData.rubrics.length > 0);
}

export function hasDraftCells(data: RubricSourceData | null | undefined): data is RubricSourceData {
  return Boolean(data);
}
