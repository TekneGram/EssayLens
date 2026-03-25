import type { AppAction } from './actions';
import { initialAppState, initialRubricState, initialUiState } from './initialState';
import type { AppState, RubricState, UiState } from './types';
import { chatReducer } from '@/features/chat-interface/state/chatInterface.reducer';
import { workspaceReducer } from '@/features/workspace/state/workspace.reducer';

const ASSESSMENT_SPLIT_MIN = 0.35;
const ASSESSMENT_SPLIT_MAX = 0.8;

function clampAssessmentSplitRatio(value: number): number {
  if (!Number.isFinite(value)) {
    return initialUiState.assessmentSplitRatio;
  }
  return Math.min(ASSESSMENT_SPLIT_MAX, Math.max(ASSESSMENT_SPLIT_MIN, value));
}

export function rubricReducer(state: RubricState = initialRubricState, action: AppAction): RubricState {
  switch (action.type) {
    case 'rubric/selectGradingForFile': {
      const nextSelectedByFileId = { ...state.selectedGradingRubricIdByFileId };
      if (!action.payload.rubricId) {
        delete nextSelectedByFileId[action.payload.fileId];
      } else {
        nextSelectedByFileId[action.payload.fileId] = action.payload.rubricId;
      }
      return {
        ...state,
        selectedGradingRubricIdByFileId: nextSelectedByFileId
      };
    }
    case 'rubric/setLockedGradingRubricId':
      return {
        ...state,
        lockedGradingRubricId: action.payload
      };
    case 'rubric/setGradingSelection':
      return {
        ...state,
        gradingSelectionByFileId: {
          ...state.gradingSelectionByFileId,
          [action.payload.fileId]: {
            rubricId: action.payload.rubricId,
            selectedCellKeys: action.payload.selectedCellKeys
          }
        }
      };
    case 'rubric/clearGradingSelection': {
      const nextSelection = { ...state.gradingSelectionByFileId };
      delete nextSelection[action.payload.fileId];
      return {
        ...state,
        gradingSelectionByFileId: nextSelection
      };
    }
    default:
      return state;
  }
}

export function uiReducer(state: UiState = initialUiState, action: AppAction): UiState {
  switch (action.type) {
    case 'ui/setTopTab':
      return {
        ...state,
        activeTopTab: action.payload
      };
    case 'ui/setCommentsTab':
      return {
        ...state,
        activeCommentsTab: action.payload
      };
    case 'ui/setChatCollapsed':
      return {
        ...state,
        isChatCollapsed: action.payload
      };
    case 'ui/setAssessmentSplitRatio':
      return {
        ...state,
        assessmentSplitRatio: clampAssessmentSplitRatio(action.payload)
      };
    default:
      return state;
  }
}

export function appReducer(state: AppState = initialAppState, action: AppAction): AppState {
  return {
    workspace: workspaceReducer(state.workspace, action),
    chat: chatReducer(state.chat, action),
    rubric: rubricReducer(state.rubric, action),
    ui: uiReducer(state.ui, action)
  };
}

export { chatReducer };
export { workspaceReducer };
