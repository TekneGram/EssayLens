import type { RubricCell, RubricInteractionMode } from '@/features/rubric-for-react/domain';

export function normalizeSelection(keys: Iterable<string>): string {
  return Array.from(keys).sort().join('||');
}

export function areSetsEqual(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) {
    return false;
  }
  for (const value of left) {
    if (!right.has(value)) {
      return false;
    }
  }
  return true;
}

export function pruneSelectionToExistingCells(previous: Set<string>, cellsByKey: Record<string, RubricCell>): Set<string> {
  const next = new Set<string>();
  for (const key of previous) {
    if (cellsByKey[key]) {
      next.add(key);
    }
  }
  return next;
}

export function resolveEffectiveMode(params: {
  isGrading: boolean;
  canEdit: boolean;
  effectiveEditingMode: 'editing' | 'viewing';
}): RubricInteractionMode {
  if (params.isGrading) {
    return 'grading';
  }
  if (!params.canEdit) {
    return 'viewing';
  }
  return params.effectiveEditingMode;
}

export function selectCellForGrading(params: {
  previous: Set<string>;
  cellsByKey: Record<string, RubricCell>;
  selectedKey: string;
  categoryId: string;
}): Set<string> {
  const next = new Set<string>();
  for (const existingKey of params.previous) {
    const existingCell = params.cellsByKey[existingKey];
    if (!existingCell) {
      continue;
    }
    if (existingCell.categoryId === params.categoryId) {
      continue;
    }
    next.add(existingKey);
  }
  next.add(params.selectedKey);
  return next;
}

export function deselectCellForGrading(previous: Set<string>, selectedKey: string): Set<string> {
  if (!previous.has(selectedKey)) {
    return previous;
  }
  const next = new Set(previous);
  next.delete(selectedKey);
  return next;
}

export function isPersistableDetailId(detailId?: string): boolean {
  if (!detailId) {
    return false;
  }
  return !detailId.startsWith('temp_') && !detailId.startsWith('temp:');
}
