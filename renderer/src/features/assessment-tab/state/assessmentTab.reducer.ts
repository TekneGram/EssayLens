import type { AssessmentTabAction } from './assessmentTab.actions';
import type { AssessmentTabLocalState } from './assessmentTab.types';

export const initialAssessmentTabState: AssessmentTabLocalState = {
  pendingSelection: null,
  activeCommentSelection: null,
  activeCommand: null,
  chatMode: 'comment',
  activeCommentId: null,
  draftText: ''
};

export function assessmentTabReducer(
  state: AssessmentTabLocalState = initialAssessmentTabState,
  action: AssessmentTabAction
): AssessmentTabLocalState {
  switch (action.type) {
    case 'assessmentTab/setPendingSelection':
      return {
        ...state,
        pendingSelection: action.payload
      };
    case 'assessmentTab/setActiveCommentSelection':
      return {
        ...state,
        activeCommentSelection: action.payload
      };
    case 'assessmentTab/setActiveCommand':
      return {
        ...state,
        activeCommand: action.payload
      };
    case 'assessmentTab/clearActiveCommentIfMatch':
      return {
        ...state,
        activeCommentId: state.activeCommentId === action.payload ? null : state.activeCommentId,
        activeCommentSelection: state.activeCommentId === action.payload ? null : state.activeCommentSelection
      };
    case 'assessmentTab/setChatMode':
      return {
        ...state,
        chatMode: action.payload
      };
    case 'assessmentTab/setActiveCommentId':
      return {
        ...state,
        activeCommentId: action.payload,
        activeCommentSelection: action.payload ? state.activeCommentSelection : null
      };
    case 'assessmentTab/setDraftText':
      return {
        ...state,
        draftText: action.payload
      };
    default:
      return state;
  }
}
