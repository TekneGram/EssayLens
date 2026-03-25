import type {
  AssessmentTopTab,
  CommentsTab,
  EntityId,
  WorkspaceAction
} from './types';
import type { ChatInterfaceAction } from '@/features/chat-interface/state/chatInterface.actions';

export type ChatAction = ChatInterfaceAction;

export type RubricAction =
  | { type: 'rubric/selectGradingForFile'; payload: { fileId: EntityId; rubricId: EntityId | null } }
  | { type: 'rubric/setLockedGradingRubricId'; payload: EntityId | null }
  | {
      type: 'rubric/setGradingSelection';
      payload: { fileId: EntityId; rubricId: EntityId; selectedCellKeys: string[] };
    }
  | { type: 'rubric/clearGradingSelection'; payload: { fileId: EntityId } };

export type UiAction =
  | { type: 'ui/setTopTab'; payload: AssessmentTopTab }
  | { type: 'ui/setCommentsTab'; payload: CommentsTab }
  | { type: 'ui/setChatCollapsed'; payload: boolean }
  | { type: 'ui/setAssessmentSplitRatio'; payload: number };

export type AppAction = WorkspaceAction | ChatAction | RubricAction | UiAction;
