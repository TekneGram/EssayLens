import { useCallback, useEffect, useRef, useState } from 'react';
import { createCellKey } from '@/features/rubric-for-react/domain';
import {
  areSetsEqual,
  deselectCellForGrading,
  normalizeSelection,
  pruneSelectionToExistingCells,
  selectCellForGrading
} from '@/features/rubric-for-react/application/rubricForReact.workflows';
import type { RubricCell } from '@/features/rubric-for-react/domain';

interface UseRubricSelectionParams {
  isGrading?: boolean;
  initialSelectedCellKeys?: string[];
  onSelectedCellKeysChange?: (selectedCellKeys: string[]) => void;
  cellsByKey: Record<string, RubricCell>;
}

interface UseRubricSelectionResult {
  selectedCellKeys: Set<string>;
  selectCell: (categoryId: string, scoreId: string) => void;
  deselectCell: (categoryId: string, scoreId: string) => void;
}

export function useRubricSelection({
  isGrading = false,
  initialSelectedCellKeys,
  onSelectedCellKeysChange,
  cellsByKey
}: UseRubricSelectionParams): UseRubricSelectionResult {
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(() => new Set(initialSelectedCellKeys ?? []));
  const lastEmittedSelectionRef = useRef<string>('');

  useEffect(() => {
    if (!initialSelectedCellKeys) {
      return;
    }
    const incoming = new Set(initialSelectedCellKeys);
    setSelectedCellKeys((previous) => (areSetsEqual(previous, incoming) ? previous : incoming));
  }, [initialSelectedCellKeys]);

  useEffect(() => {
    if (!onSelectedCellKeysChange) {
      return;
    }
    const normalized = normalizeSelection(selectedCellKeys);
    if (normalized === lastEmittedSelectionRef.current) {
      return;
    }
    lastEmittedSelectionRef.current = normalized;
    onSelectedCellKeysChange(Array.from(selectedCellKeys));
  }, [onSelectedCellKeysChange, selectedCellKeys]);

  useEffect(() => {
    setSelectedCellKeys((previous) => {
      const pruned = pruneSelectionToExistingCells(previous, cellsByKey);
      return areSetsEqual(previous, pruned) ? previous : pruned;
    });
  }, [cellsByKey]);

  const selectCell = useCallback(
    (categoryId: string, scoreId: string) => {
      if (!isGrading) {
        return;
      }
      const key = createCellKey(categoryId, scoreId);
      setSelectedCellKeys((previous) =>
        selectCellForGrading({
          previous,
          cellsByKey,
          selectedKey: key,
          categoryId
        })
      );
    },
    [cellsByKey, isGrading]
  );

  const deselectCell = useCallback(
    (categoryId: string, scoreId: string) => {
      if (!isGrading) {
        return;
      }
      const key = createCellKey(categoryId, scoreId);
      setSelectedCellKeys((previous) => deselectCellForGrading(previous, key));
    },
    [isGrading]
  );

  return { selectedCellKeys, selectCell, deselectCell };
}
