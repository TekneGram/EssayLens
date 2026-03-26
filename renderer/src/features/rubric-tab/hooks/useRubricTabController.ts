import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import {
  cloneRubricAndSelect,
  createRubricAndSelect,
  deleteRubricAndClearSelection,
  reconcileRubricSelection,
  selectRubric,
  setRubricInteractionMode
} from '@/features/rubric-tab/application';
import { computeCanEditSelectedRubric } from '@/features/rubric-tab/domain';
import { useRubricListQuery, useRubricMutations } from '@/features/rubric-data';
import { useRubricTabDispatch, useRubricTabState } from '@/features/rubric-tab/state';

export function useRubricTabController() {
  const state = useRubricTabState();
  const dispatch = useRubricTabDispatch();
  const selectedRubricId = state.selectedEditingRubricId;
  const interactionMode = state.interactionMode;

  const listQuery = useRubricListQuery();
  const { setLastUsed, createRubric, cloneRubric, deleteRubric } = useRubricMutations(selectedRubricId);
  const lastErrorAt = useRef<number | null>(null);

  const flushPendingUpdates = async () => {
    return;
  };

  useEffect(() => {
    if (!listQuery.isError) {
      return;
    }
    const nextErrorAt = listQuery.errorUpdatedAt;
    if (lastErrorAt.current === nextErrorAt) {
      return;
    }
    lastErrorAt.current = nextErrorAt;

    const message = listQuery.error instanceof Error ? listQuery.error.message : 'Unable to load rubrics.';
    toast.error(message);
  }, [listQuery.error, listQuery.errorUpdatedAt, listQuery.isError]);

  useEffect(() => {
    if (!listQuery.isSuccess) {
      return;
    }
    const reconciliation = reconcileRubricSelection({
      rubrics: listQuery.data.rubrics,
      selectedRubricId,
      lastUsedRubricId: listQuery.data.lastUsedRubricId
    });
    if (!reconciliation) {
      return;
    }
    dispatch({ type: 'rubricTab/selectEditing', payload: reconciliation.rubricId });
    dispatch({ type: 'rubricTab/setInteractionMode', payload: reconciliation.mode });
  }, [dispatch, listQuery.data, listQuery.isSuccess, selectedRubricId]);

  const rubricList = listQuery.data?.rubrics ?? [];
  const selectedRubric = rubricList.find((rubric) => rubric.entityUuid === selectedRubricId);
  const canEditSelectedRubric = computeCanEditSelectedRubric(selectedRubric);

  return {
    rubricList,
    selectedRubricId,
    interactionMode,
    listQuery,
    selectedRubric,
    canEditSelectedRubric,
    selectRubric: (rubricId: string) => selectRubric({ dispatch, flushPendingUpdates, setLastUsed }, rubricId),
    createRubric: () => createRubricAndSelect({ dispatch, flushPendingUpdates, createRubric }, 'New Rubric'),
    cloneRubric: () => {
      if (!selectedRubricId) {
        return Promise.resolve();
      }
      return cloneRubricAndSelect({ dispatch, flushPendingUpdates, cloneRubric, setLastUsed }, selectedRubricId);
    },
    deleteRubric: () => {
      if (!selectedRubricId) {
        return Promise.resolve();
      }
      return deleteRubricAndClearSelection({ dispatch, flushPendingUpdates, deleteRubric }, selectedRubricId);
    },
    setInteractionMode: (mode: 'editing' | 'viewing') => setRubricInteractionMode(dispatch, flushPendingUpdates, mode)
  };
}
