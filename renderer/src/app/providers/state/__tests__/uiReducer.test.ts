import { describe, expect, it } from 'vitest';
import { initialUiState } from '../initialState';
import { uiReducer } from '../reducers';

describe('uiReducer', () => {
  it('changes active top tab', () => {
    const next = uiReducer(initialUiState, {
      type: 'ui/setTopTab',
      payload: 'llm'
    });

    expect(next.activeTopTab).toBe('llm');
    expect(initialUiState.activeTopTab).toBe('assessment');
  });

  it('changes comments tab', () => {
    const next = uiReducer(initialUiState, {
      type: 'ui/setCommentsTab',
      payload: 'score'
    });

    expect(next.activeCommentsTab).toBe('score');
  });

  it('changes chat collapsed state', () => {
    const collapsed = uiReducer(initialUiState, {
      type: 'ui/setChatCollapsed',
      payload: true
    });

    expect(collapsed.isChatCollapsed).toBe(true);
    expect(initialUiState.isChatCollapsed).toBe(false);
  });

  it('sets and clamps assessment split ratio', () => {
    const updated = uiReducer(initialUiState, {
      type: 'ui/setAssessmentSplitRatio',
      payload: 0.72
    });
    const clampedLow = uiReducer(initialUiState, {
      type: 'ui/setAssessmentSplitRatio',
      payload: 0.1
    });
    const clampedHigh = uiReducer(initialUiState, {
      type: 'ui/setAssessmentSplitRatio',
      payload: 1.2
    });

    expect(updated.assessmentSplitRatio).toBe(0.72);
    expect(clampedLow.assessmentSplitRatio).toBe(0.35);
    expect(clampedHigh.assessmentSplitRatio).toBe(0.8);
  });
});
