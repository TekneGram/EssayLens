import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRubricTabController } from '@/features/rubric-tab/hooks/useRubricTabController';

const {
  mockUseRubricTabState,
  mockUseRubricTabDispatch,
  mockUseRubricListQuery,
  mockUseRubricMutations,
  mockReconcileRubricSelection,
  mockSelectRubric,
  mockCreateRubricAndSelect,
  mockCloneRubricAndSelect,
  mockDeleteRubricAndClearSelection,
  mockSetRubricInteractionMode
} = vi.hoisted(() => ({
  mockUseRubricTabState: vi.fn(),
  mockUseRubricTabDispatch: vi.fn(),
  mockUseRubricListQuery: vi.fn(),
  mockUseRubricMutations: vi.fn(),
  mockReconcileRubricSelection: vi.fn(),
  mockSelectRubric: vi.fn().mockResolvedValue(undefined),
  mockCreateRubricAndSelect: vi.fn().mockResolvedValue(undefined),
  mockCloneRubricAndSelect: vi.fn().mockResolvedValue(undefined),
  mockDeleteRubricAndClearSelection: vi.fn().mockResolvedValue(undefined),
  mockSetRubricInteractionMode: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../state', () => ({
  useRubricTabState: mockUseRubricTabState,
  useRubricTabDispatch: mockUseRubricTabDispatch
}));

vi.mock('../../../rubric-data', () => ({
  useRubricListQuery: mockUseRubricListQuery,
  useRubricMutations: mockUseRubricMutations
}));

vi.mock('../../application', () => ({
  reconcileRubricSelection: mockReconcileRubricSelection,
  selectRubric: mockSelectRubric,
  createRubricAndSelect: mockCreateRubricAndSelect,
  cloneRubricAndSelect: mockCloneRubricAndSelect,
  deleteRubricAndClearSelection: mockDeleteRubricAndClearSelection,
  setRubricInteractionMode: mockSetRubricInteractionMode
}));

describe('useRubricTabController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRubricTabState.mockReturnValue({
      selectedEditingRubricId: 'r1',
      interactionMode: 'viewing'
    });
    mockUseRubricTabDispatch.mockReturnValue(vi.fn());
    mockUseRubricListQuery.mockReturnValue({
      isSuccess: true,
      data: {
        rubrics: [{ entityUuid: 'r1', name: 'Rubric 1', isActive: false, isArchived: false }],
        lastUsedRubricId: 'r1'
      },
      isPending: false,
      isError: false
    });
    mockUseRubricMutations.mockReturnValue({
      setLastUsed: vi.fn().mockResolvedValue(undefined),
      createRubric: vi.fn().mockResolvedValue('new-id'),
      cloneRubric: vi.fn().mockResolvedValue('clone-id'),
      deleteRubric: vi.fn().mockResolvedValue(undefined)
    });
    mockReconcileRubricSelection.mockReturnValue(null);
  });

  it('delegates action handlers to application workflows', async () => {
    const { result } = renderHook(() => useRubricTabController());

    await act(async () => {
      await result.current.selectRubric('r1');
      await result.current.createRubric();
      await result.current.cloneRubric();
      await result.current.deleteRubric();
      await result.current.setInteractionMode('editing');
    });

    expect(mockSelectRubric).toHaveBeenCalledTimes(1);
    expect(mockCreateRubricAndSelect).toHaveBeenCalledTimes(1);
    expect(mockCloneRubricAndSelect).toHaveBeenCalledTimes(1);
    expect(mockDeleteRubricAndClearSelection).toHaveBeenCalledTimes(1);
    expect(mockSetRubricInteractionMode).toHaveBeenCalledTimes(1);
  });

  it('dispatches reconciliation transition when workflow returns one', () => {
    const dispatch = vi.fn();
    mockUseRubricTabDispatch.mockReturnValue(dispatch);
    mockReconcileRubricSelection.mockReturnValue({ rubricId: 'r2', mode: 'viewing' });

    renderHook(() => useRubricTabController());

    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/selectEditing', payload: 'r2' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'rubricTab/setInteractionMode', payload: 'viewing' });
  });
});
