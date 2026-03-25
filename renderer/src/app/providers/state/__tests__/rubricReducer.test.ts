import { describe, expect, it } from 'vitest';
import { initialRubricState } from '../initialState';
import { rubricReducer } from '../reducers';

describe('rubricReducer', () => {
  it('selects grading rubric id by file', () => {
    const next = rubricReducer(initialRubricState, {
      type: 'rubric/selectGradingForFile',
      payload: { fileId: 'file-1', rubricId: 'rubric-1' }
    });

    expect(next.selectedGradingRubricIdByFileId['file-1']).toBe('rubric-1');
    expect(initialRubricState.selectedGradingRubricIdByFileId['file-1']).toBeUndefined();
  });

  it('stores grading selection for a file', () => {
    const next = rubricReducer(initialRubricState, {
      type: 'rubric/setGradingSelection',
      payload: {
        fileId: 'file-1',
        rubricId: 'rubric-1',
        selectedCellKeys: ['cat:Content:score:4']
      }
    });

    expect(next.gradingSelectionByFileId['file-1']?.rubricId).toBe('rubric-1');
    expect(next.gradingSelectionByFileId['file-1']?.selectedCellKeys).toEqual(['cat:Content:score:4']);
    expect(initialRubricState.gradingSelectionByFileId['file-1']).toBeUndefined();
  });
});
