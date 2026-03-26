import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRubricMutationHandlers } from '@/features/rubric-for-react/hooks/useRubricMutationHandlers';
import type { NormalizedRubric } from '@/features/rubric-for-react/domain';

function makeState(detailId = 'detail_1'): NormalizedRubric {
  return {
    rubricId: 'rubric_1',
    rubricName: 'Rubric',
    categoryOrder: ['cat1'],
    scoreOrder: ['score1'],
    categoriesById: {
      cat1: { id: 'cat1', name: 'Category 1' }
    },
    scoresById: {
      score1: { id: 'score1', value: 5 }
    },
    cellsByKey: {
      'cat1:score1': {
        key: 'cat1:score1',
        categoryId: 'cat1',
        scoreId: 'score1',
        description: 'desc',
        detailId
      }
    }
  };
}

function makeApi() {
  return {
    setRubricName: vi.fn(),
    addCategory: vi.fn(),
    addScore: vi.fn(),
    renameCategory: vi.fn(),
    setScoreValue: vi.fn(),
    removeCategory: vi.fn(),
    removeScore: vi.fn(),
    setCellDescription: vi.fn()
  };
}

describe('useRubricMutationHandlers', () => {
  it('calls both local mutation and callback for direct operations', () => {
    const rubricStateApi = makeApi();
    const onSetRubricName = vi.fn();
    const onAddCategory = vi.fn();
    const onAddScore = vi.fn();

    const { result } = renderHook(() =>
      useRubricMutationHandlers({
        state: makeState(),
        rubricStateApi,
        callbacks: { onSetRubricName, onAddCategory, onAddScore }
      })
    );

    act(() => {
      result.current.handleSetRubricName('New');
      result.current.handleAddCategory('Grammar');
      result.current.handleAddScore(10);
    });

    expect(rubricStateApi.setRubricName).toHaveBeenCalledWith('New');
    expect(onSetRubricName).toHaveBeenCalledWith('New');
    expect(rubricStateApi.addCategory).toHaveBeenCalledWith('Grammar');
    expect(onAddCategory).toHaveBeenCalledWith('Grammar');
    expect(rubricStateApi.addScore).toHaveBeenCalledWith(10);
    expect(onAddScore).toHaveBeenCalledWith(10);
  });

  it('emits rename/set-score/remove callbacks only when value actually changes', () => {
    const rubricStateApi = makeApi();
    const onRenameCategory = vi.fn();
    const onSetScoreValue = vi.fn();
    const onRemoveCategory = vi.fn();
    const onRemoveScore = vi.fn();

    const { result } = renderHook(() =>
      useRubricMutationHandlers({
        state: makeState(),
        rubricStateApi,
        callbacks: { onRenameCategory, onSetScoreValue, onRemoveCategory, onRemoveScore }
      })
    );

    act(() => {
      result.current.handleRenameCategory('cat1', 'Category 1');
      result.current.handleRenameCategory('cat1', 'Category A');
      result.current.handleSetScoreValue('score1', 5);
      result.current.handleSetScoreValue('score1', 8);
      result.current.handleRemoveCategory('cat1');
      result.current.handleRemoveScore('score1');
    });

    expect(onRenameCategory).toHaveBeenCalledTimes(1);
    expect(onRenameCategory).toHaveBeenCalledWith('Category 1', 'Category A');
    expect(onSetScoreValue).toHaveBeenCalledTimes(1);
    expect(onSetScoreValue).toHaveBeenCalledWith(5, 8);
    expect(onRemoveCategory).toHaveBeenCalledWith('Category 1');
    expect(onRemoveScore).toHaveBeenCalledWith(5);
  });

  it('does not emit cell-description callback for temporary detail ids', () => {
    const rubricStateApi = makeApi();
    const onSetCellDescription = vi.fn();
    const { result: persisted } = renderHook(() =>
      useRubricMutationHandlers({
        state: makeState('detail_1'),
        rubricStateApi,
        callbacks: { onSetCellDescription }
      })
    );
    const { result: temporary } = renderHook(() =>
      useRubricMutationHandlers({
        state: makeState('temp_1'),
        rubricStateApi,
        callbacks: { onSetCellDescription }
      })
    );

    act(() => {
      persisted.current.handleSetCellDescription('cat1', 'score1', 'updated');
      temporary.current.handleSetCellDescription('cat1', 'score1', 'updated');
    });

    expect(rubricStateApi.setCellDescription).toHaveBeenCalledTimes(2);
    expect(onSetCellDescription).toHaveBeenCalledTimes(1);
    expect(onSetCellDescription).toHaveBeenCalledWith('detail_1', 'updated');
  });
});
