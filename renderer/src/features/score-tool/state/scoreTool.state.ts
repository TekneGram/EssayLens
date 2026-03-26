export interface ScoreToolLocalState {
  isResettingAfterRubricClear: boolean;
}

export type ScoreToolAction =
  | { type: 'scoreTool/startResetAfterClear' }
  | { type: 'scoreTool/finishResetAfterClear' };

export const initialScoreToolState: ScoreToolLocalState = {
  isResettingAfterRubricClear: false
};

export function scoreToolReducer(state: ScoreToolLocalState, action: ScoreToolAction): ScoreToolLocalState {
  switch (action.type) {
    case 'scoreTool/startResetAfterClear':
      return {
        ...state,
        isResettingAfterRubricClear: true
      };
    case 'scoreTool/finishResetAfterClear':
      return {
        ...state,
        isResettingAfterRubricClear: false
      };
    default:
      return state;
  }
}
