import { useCallback } from 'react';
import { createCellKey } from '@/features/rubric-for-react/domain';
import { isPersistableDetailId } from '@/features/rubric-for-react/application/rubricForReact.workflows';
import type { RubricStateApi } from '@/features/rubric-for-react/state/useRubricState';
import type { NormalizedRubric } from '@/features/rubric-for-react/domain';
import type { RubricForReactProps } from '@/features/rubric-for-react/domain';

interface UseRubricMutationHandlersParams {
  state: NormalizedRubric;
  rubricStateApi: Pick<
    RubricStateApi,
    | 'setRubricName'
    | 'addCategory'
    | 'addScore'
    | 'renameCategory'
    | 'setScoreValue'
    | 'removeCategory'
    | 'removeScore'
    | 'setCellDescription'
  >;
  callbacks: Pick<
    RubricForReactProps,
    | 'onSetRubricName'
    | 'onAddCategory'
    | 'onAddScore'
    | 'onRenameCategory'
    | 'onSetScoreValue'
    | 'onRemoveCategory'
    | 'onRemoveScore'
    | 'onSetCellDescription'
  >;
}

export function useRubricMutationHandlers({ state, rubricStateApi, callbacks }: UseRubricMutationHandlersParams) {
  const handleSetRubricName = useCallback(
    (name: string) => {
      rubricStateApi.setRubricName(name);
      callbacks.onSetRubricName?.(name);
    },
    [callbacks, rubricStateApi]
  );

  const handleAddCategory = useCallback(
    (name: string) => {
      rubricStateApi.addCategory(name);
      callbacks.onAddCategory?.(name);
    },
    [callbacks, rubricStateApi]
  );

  const handleAddScore = useCallback(
    (value: number) => {
      rubricStateApi.addScore(value);
      callbacks.onAddScore?.(value);
    },
    [callbacks, rubricStateApi]
  );

  const handleRenameCategory = useCallback(
    (categoryId: string, nextName: string) => {
      const current = state.categoriesById[categoryId];
      rubricStateApi.renameCategory(categoryId, nextName);
      if (!current || current.name === nextName) {
        return;
      }
      callbacks.onRenameCategory?.(current.name, nextName);
    },
    [callbacks, rubricStateApi, state.categoriesById]
  );

  const handleSetScoreValue = useCallback(
    (scoreId: string, nextValue: number) => {
      const current = state.scoresById[scoreId];
      rubricStateApi.setScoreValue(scoreId, nextValue);
      if (!current || current.value === nextValue) {
        return;
      }
      callbacks.onSetScoreValue?.(current.value, nextValue);
    },
    [callbacks, rubricStateApi, state.scoresById]
  );

  const handleRemoveCategory = useCallback(
    (categoryId: string) => {
      const current = state.categoriesById[categoryId];
      rubricStateApi.removeCategory(categoryId);
      if (!current) {
        return;
      }
      callbacks.onRemoveCategory?.(current.name);
    },
    [callbacks, rubricStateApi, state.categoriesById]
  );

  const handleRemoveScore = useCallback(
    (scoreId: string) => {
      const current = state.scoresById[scoreId];
      rubricStateApi.removeScore(scoreId);
      if (!current) {
        return;
      }
      callbacks.onRemoveScore?.(current.value);
    },
    [callbacks, rubricStateApi, state.scoresById]
  );

  const handleSetCellDescription = useCallback(
    (categoryId: string, scoreId: string, description: string) => {
      const key = createCellKey(categoryId, scoreId);
      const cell = state.cellsByKey[key];
      const detailId = cell?.detailId;
      rubricStateApi.setCellDescription(categoryId, scoreId, description);
      if (!detailId || !isPersistableDetailId(detailId)) {
        return;
      }
      callbacks.onSetCellDescription?.(detailId, description);
    },
    [callbacks, rubricStateApi, state.cellsByKey]
  );

  return {
    handleSetRubricName,
    handleAddCategory,
    handleAddScore,
    handleRenameCategory,
    handleSetScoreValue,
    handleRemoveCategory,
    handleRemoveScore,
    handleSetCellDescription
  };
}
