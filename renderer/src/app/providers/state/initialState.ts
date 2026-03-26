import { initialChatState } from '@/layout/ChatInterface/state/chatInterface.initialState';
import type { AppState, RubricState, UiState } from './types';
import { initialWorkspaceState } from '@/layout/FileControlContainer/state/workspace.reducer';

export const initialRubricState: RubricState = {
  selectedGradingRubricIdByFileId: {},
  lockedGradingRubricId: null,
  gradingSelectionByFileId: {}
};

export const initialUiState: UiState = {
  activeTopTab: 'assessment',
  activeCommentsTab: 'comments',
  isChatCollapsed: false,
  assessmentSplitRatio: 0.66
};

export const initialAppState: AppState = {
  workspace: initialWorkspaceState,
  chat: initialChatState,
  rubric: initialRubricState,
  ui: initialUiState
};

export { initialChatState };
export { initialWorkspaceState };
