export interface RubricListItem {
  entityUuid: string;
  isActive: boolean;
}

interface ResolvePreferredRubricSelectionArgs {
  rubrics: RubricListItem[];
  selectedRubricId: string | null;
  lastUsedRubricId?: string;
}

export function isSelectedRubricStillValid(rubrics: RubricListItem[], selectedRubricId: string | null): boolean {
  if (!selectedRubricId) {
    return false;
  }
  return rubrics.some((rubric) => rubric.entityUuid === selectedRubricId);
}

export function resolvePreferredRubricSelection(args: ResolvePreferredRubricSelectionArgs): string | null {
  const { rubrics, selectedRubricId, lastUsedRubricId } = args;

  if (rubrics.length === 0) {
    return null;
  }

  if (isSelectedRubricStillValid(rubrics, selectedRubricId)) {
    return selectedRubricId;
  }

  const hasLastUsed = Boolean(lastUsedRubricId && rubrics.some((rubric) => rubric.entityUuid === lastUsedRubricId));
  if (hasLastUsed) {
    return lastUsedRubricId ?? null;
  }

  return rubrics[0].entityUuid;
}

export function computeCanEditSelectedRubric(selectedRubric?: RubricListItem): boolean {
  if (!selectedRubric) {
    return true;
  }
  return !selectedRubric.isActive;
}
