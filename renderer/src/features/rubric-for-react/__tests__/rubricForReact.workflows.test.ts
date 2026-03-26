import { describe, expect, it } from 'vitest';
import {
  areSetsEqual,
  deselectCellForGrading,
  isPersistableDetailId,
  pruneSelectionToExistingCells,
  resolveEffectiveMode,
  selectCellForGrading
} from '@/features/rubric-for-react/application/rubricForReact.workflows';

describe('rubricForReact.workflows', () => {
  it('resolves effective mode with grading and edit constraints', () => {
    expect(resolveEffectiveMode({ isGrading: true, canEdit: true, effectiveEditingMode: 'editing' })).toBe('grading');
    expect(resolveEffectiveMode({ isGrading: false, canEdit: false, effectiveEditingMode: 'editing' })).toBe('viewing');
    expect(resolveEffectiveMode({ isGrading: false, canEdit: true, effectiveEditingMode: 'viewing' })).toBe('viewing');
  });

  it('selects one cell per category in grading mode', () => {
    const previous = new Set(['cat1::score1', 'cat2::score1']);
    const next = selectCellForGrading({
      previous,
      selectedKey: 'cat1::score2',
      categoryId: 'cat1',
      cellsByKey: {
        'cat1::score1': { key: 'cat1::score1', categoryId: 'cat1', scoreId: 'score1', description: '' },
        'cat1::score2': { key: 'cat1::score2', categoryId: 'cat1', scoreId: 'score2', description: '' },
        'cat2::score1': { key: 'cat2::score1', categoryId: 'cat2', scoreId: 'score1', description: '' }
      }
    });

    expect(Array.from(next).sort()).toEqual(['cat1::score2', 'cat2::score1']);
  });

  it('deselects when key exists and preserves set reference when key is missing', () => {
    const previous = new Set(['cat1::score1']);
    const missingResult = deselectCellForGrading(previous, 'cat1::score2');
    const removedResult = deselectCellForGrading(previous, 'cat1::score1');

    expect(missingResult).toBe(previous);
    expect(Array.from(removedResult)).toEqual([]);
  });

  it('prunes selection to existing cells', () => {
    const previous = new Set(['cat1::score1', 'cat2::score1']);
    const pruned = pruneSelectionToExistingCells(previous, {
      'cat1::score1': { key: 'cat1::score1', categoryId: 'cat1', scoreId: 'score1', description: '' }
    });

    expect(Array.from(pruned)).toEqual(['cat1::score1']);
  });

  it('checks set equality', () => {
    expect(areSetsEqual(new Set(['a', 'b']), new Set(['b', 'a']))).toBe(true);
    expect(areSetsEqual(new Set(['a']), new Set(['a', 'b']))).toBe(false);
  });

  it('allows only persisted detail ids', () => {
    expect(isPersistableDetailId(undefined)).toBe(false);
    expect(isPersistableDetailId('temp_123')).toBe(false);
    expect(isPersistableDetailId('temp:123')).toBe(false);
    expect(isPersistableDetailId('detail_123')).toBe(true);
  });
});
