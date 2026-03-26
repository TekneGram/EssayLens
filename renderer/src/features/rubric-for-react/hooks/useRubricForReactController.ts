import { useEffect } from 'react';
import { useRubricState } from '@/features/rubric-for-react/state';
import { useRubricMode } from '@/features/rubric-for-react/hooks/useRubricMode';
import { useRubricMutationHandlers } from '@/features/rubric-for-react/hooks/useRubricMutationHandlers';
import { useRubricSelection } from '@/features/rubric-for-react/hooks/useRubricSelection';
import type { RubricForReactProps } from '@/features/rubric-for-react/domain';
import { useRubricForReactData } from '@/features/rubric-for-react/hooks/useRubricForReactData';
import { useRubricForReactPersistence } from '@/features/rubric-for-react/hooks/useRubricForReactPersistence';

export function useRubricForReactController({
  rubricId = null,
  sourceData,
  isGrading = false,
  canEdit = true,
  mode,
  onModeChange,
  onSelectedCellKeysChange,
  initialSelectedCellKeys,
  onSetRubricName,
  onAddCategory,
  onAddScore,
  onRenameCategory,
  onRemoveCategory,
  onSetScoreValue,
  onRemoveScore,
  onSetCellDescription,
  onChange
}: RubricForReactProps) {
  const shouldLoadFromRubricId = !sourceData && Boolean(rubricId);
  const dataQuery = useRubricForReactData(shouldLoadFromRubricId ? rubricId : null, shouldLoadFromRubricId);
  const resolvedSourceData = sourceData ?? dataQuery.data ?? undefined;

  const { persistImmediate, scheduleUpdate, errorMessage: persistenceErrorMessage } = useRubricForReactPersistence(
    shouldLoadFromRubricId ? rubricId : null
  );

  const rubricStateApi = useRubricState(resolvedSourceData);
  const { state } = rubricStateApi;

  useEffect(() => {
    onChange?.(state);
  }, [onChange, state]);

  const { effectiveEditingMode, effectiveMode, toggleMode } = useRubricMode({
    isGrading,
    canEdit,
    mode,
    onModeChange
  });

  const { selectedCellKeys, selectCell, deselectCell } = useRubricSelection({
    isGrading,
    initialSelectedCellKeys,
    onSelectedCellKeysChange,
    cellsByKey: state.cellsByKey
  });

  const {
    handleSetRubricName,
    handleAddCategory,
    handleAddScore,
    handleRenameCategory,
    handleSetScoreValue,
    handleRemoveCategory,
    handleRemoveScore,
    handleSetCellDescription
  } = useRubricMutationHandlers({
    state,
    rubricStateApi,
    callbacks: {
      onSetRubricName: (name) => {
        if (shouldLoadFromRubricId) {
          scheduleUpdate('rubric-name', { type: 'setRubricName', name });
        }
        void onSetRubricName?.(name);
      },
      onAddCategory: (name) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'createCategory', name });
        }
        void onAddCategory?.(name);
      },
      onAddScore: (value) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'createScore', value });
        }
        void onAddScore?.(value);
      },
      onRenameCategory: (from, to) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'updateCategoryName', from, to });
        }
        void onRenameCategory?.(from, to);
      },
      onSetScoreValue: (from, to) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'updateScoreValue', from, to });
        }
        void onSetScoreValue?.(from, to);
      },
      onRemoveCategory: (categoryName) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'deleteCategory', category: categoryName });
        }
        void onRemoveCategory?.(categoryName);
      },
      onRemoveScore: (scoreValue) => {
        if (shouldLoadFromRubricId) {
          void persistImmediate({ type: 'deleteScore', value: scoreValue });
        }
        void onRemoveScore?.(scoreValue);
      },
      onSetCellDescription: (detailId, description) => {
        if (shouldLoadFromRubricId) {
          scheduleUpdate(`detail:${detailId}`, { type: 'updateCellDescription', detailId, description });
        }
        void onSetCellDescription?.(detailId, description);
      }
    }
  });

  return {
    isLoading: shouldLoadFromRubricId && dataQuery.isPending,
    isError: shouldLoadFromRubricId && dataQuery.isError,
    errorMessage:
      (dataQuery.error instanceof Error ? dataQuery.error.message : undefined) ??
      persistenceErrorMessage,
    state,
    effectiveEditingMode,
    effectiveMode,
    selectedCellKeys,
    toggleMode,
    handleSetRubricName,
    handleAddCategory,
    handleAddScore,
    handleRenameCategory,
    handleSetScoreValue,
    handleRemoveCategory,
    handleRemoveScore,
    handleSetCellDescription,
    selectCell,
    deselectCell
  };
}
