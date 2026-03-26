import { describe, expect, it, vi } from 'vitest';
import {
  cloneRubricAndSelect,
  createRubricAndSelect,
  deleteRubricAndClearSelection,
  reconcileRubricSelection,
  selectRubric,
  setRubricInteractionMode
} from '@/features/rubric-tab/application';
import { RubricUpdateQueue } from '@/features/rubric-tab/application';

describe('rubric-tab application workflows', () => {
  it('reconciles rubric selection from list state', () => {
    expect(
      reconcileRubricSelection({
        rubrics: [],
        selectedRubricId: 'r1',
        lastUsedRubricId: 'r2'
      })
    ).toEqual({ rubricId: null, mode: 'viewing' });

    expect(
      reconcileRubricSelection({
        rubrics: [{ entityUuid: 'r1', isActive: false }],
        selectedRubricId: 'r1',
        lastUsedRubricId: 'r1'
      })
    ).toBeNull();

    expect(
      reconcileRubricSelection({
        rubrics: [
          { entityUuid: 'r1', isActive: false },
          { entityUuid: 'r2', isActive: false }
        ],
        selectedRubricId: 'missing',
        lastUsedRubricId: 'r2'
      })
    ).toEqual({ rubricId: 'r2', mode: 'viewing' });
  });

  it('runs select/create/clone/delete workflows with expected dispatch transitions', async () => {
    const dispatch = vi.fn();
    const flushPendingUpdates = vi.fn().mockResolvedValue(undefined);
    const setLastUsed = vi.fn().mockResolvedValue(undefined);
    const createRubric = vi.fn().mockResolvedValue('created-id');
    const cloneRubric = vi.fn().mockResolvedValue('cloned-id');
    const deleteRubric = vi.fn().mockResolvedValue(undefined);

    await selectRubric({ dispatch, flushPendingUpdates, setLastUsed }, 'r1');
    await createRubricAndSelect({ dispatch, flushPendingUpdates, createRubric }, 'New Rubric');
    await cloneRubricAndSelect({ dispatch, flushPendingUpdates, cloneRubric, setLastUsed }, 'r1');
    await deleteRubricAndClearSelection({ dispatch, flushPendingUpdates, deleteRubric }, 'r1');
    await setRubricInteractionMode(dispatch, flushPendingUpdates, 'editing');

    expect(flushPendingUpdates).toHaveBeenCalledTimes(5);
    expect(setLastUsed).toHaveBeenCalledWith('r1');
    expect(setLastUsed).toHaveBeenCalledWith('cloned-id');
    expect(createRubric).toHaveBeenCalledWith('New Rubric');
    expect(cloneRubric).toHaveBeenCalledWith('r1');
    expect(deleteRubric).toHaveBeenCalledWith('r1');

    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/selectEditing', payload: 'r1' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/setInteractionMode', payload: 'viewing' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/selectEditing', payload: 'created-id' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/setInteractionMode', payload: 'editing' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/selectEditing', payload: 'cloned-id' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/selectEditing', payload: null });
  });
});

describe('RubricUpdateQueue', () => {
  it('debounces scheduled updates by key and flushes remaining operations', async () => {
    vi.useFakeTimers();
    const updateRubric = vi.fn().mockResolvedValue(undefined);
    const queue = new RubricUpdateQueue(updateRubric, 300);

    queue.schedule('name', { type: 'setRubricName', name: 'A' });
    queue.schedule('name', { type: 'setRubricName', name: 'B' });
    queue.schedule('detail:1', { type: 'updateCellDescription', detailId: 'd1', description: 'x' });

    await vi.advanceTimersByTimeAsync(300);

    expect(updateRubric).toHaveBeenCalledTimes(2);
    expect(updateRubric).toHaveBeenNthCalledWith(1, { type: 'setRubricName', name: 'B' });
    expect(updateRubric).toHaveBeenNthCalledWith(2, { type: 'updateCellDescription', detailId: 'd1', description: 'x' });

    queue.schedule('score', { type: 'createScore', value: 4 });
    await queue.flush();
    expect(updateRubric).toHaveBeenCalledWith({ type: 'createScore', value: 4 });

    vi.useRealTimers();
  });
});
