import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRubricSelection } from '@/features/rubric-for-react/hooks/useRubricSelection';

function buildCells(keys: Array<{ key: string; categoryId: string; scoreId: string }>) {
  return Object.fromEntries(keys.map((item) => [item.key, { ...item, description: '' }]));
}

describe('useRubricSelection', () => {
  it('syncs inbound selected keys and emits normalized outbound updates', () => {
    const onSelectedCellKeysChange = vi.fn();
    const { result, rerender } = renderHook(
      (props: { initialSelectedCellKeys?: string[] }) =>
        useRubricSelection({
          isGrading: true,
          initialSelectedCellKeys: props.initialSelectedCellKeys,
          onSelectedCellKeysChange,
          cellsByKey: buildCells([
            { key: 'cat1:score1', categoryId: 'cat1', scoreId: 'score1' },
            { key: 'cat1:score2', categoryId: 'cat1', scoreId: 'score2' }
          ])
        }),
      { initialProps: { initialSelectedCellKeys: ['cat1:score1'] } }
    );

    expect(onSelectedCellKeysChange).toHaveBeenCalledWith(['cat1:score1']);

    rerender({ initialSelectedCellKeys: ['cat1:score2'] });
    expect(Array.from(result.current.selectedCellKeys)).toEqual(['cat1:score2']);
  });

  it('keeps one selected score per category while grading', () => {
    const { result } = renderHook(() =>
      useRubricSelection({
        isGrading: true,
        cellsByKey: buildCells([
          { key: 'cat1:score1', categoryId: 'cat1', scoreId: 'score1' },
          { key: 'cat1:score2', categoryId: 'cat1', scoreId: 'score2' },
          { key: 'cat2:score1', categoryId: 'cat2', scoreId: 'score1' }
          ])
        })
    );

    act(() => {
      result.current.selectCell('cat1', 'score1');
      result.current.selectCell('cat2', 'score1');
      result.current.selectCell('cat1', 'score2');
    });

    expect(Array.from(result.current.selectedCellKeys).sort()).toEqual(['cat1:score2', 'cat2:score1']);
  });

  it('prunes selected keys when cells disappear', () => {
    const { result, rerender } = renderHook(
      (props: { cellsByKey: Record<string, { key: string; categoryId: string; scoreId: string; description: string }> }) =>
        useRubricSelection({
          isGrading: true,
          cellsByKey: props.cellsByKey
        }),
      {
        initialProps: {
          cellsByKey: buildCells([
            { key: 'cat1:score1', categoryId: 'cat1', scoreId: 'score1' },
            { key: 'cat2:score1', categoryId: 'cat2', scoreId: 'score1' }
          ])
        }
      }
    );

    act(() => {
      result.current.selectCell('cat1', 'score1');
      result.current.selectCell('cat2', 'score1');
    });

    rerender({
      cellsByKey: buildCells([{ key: 'cat1:score1', categoryId: 'cat1', scoreId: 'score1' }])
    });

    expect(Array.from(result.current.selectedCellKeys)).toEqual(['cat1:score1']);
  });
});
