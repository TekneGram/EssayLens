import type { AssessmentTopTab, CommentsTab, EntityId } from './primitives';
import type { ChatState } from '@/features/chat-interface/domain';
import type { WorkspaceState } from '@/features/workspace/domain/workspace.types';

export interface RubricGradingSelection {
  rubricId: EntityId;
  selectedCellKeys: string[];
}

export interface RubricState {
  selectedGradingRubricIdByFileId: Record<string, EntityId | undefined>;
  lockedGradingRubricId: EntityId | null;
  gradingSelectionByFileId: Record<string, RubricGradingSelection | undefined>;
}

export interface UiState {
  activeTopTab: AssessmentTopTab;
  activeCommentsTab: CommentsTab;
  isChatCollapsed: boolean;
  assessmentSplitRatio: number;
}

export interface AppState {
  workspace: WorkspaceState;
  chat: ChatState;
  rubric: RubricState;
  ui: UiState;
}

export type SelectedFileType = 'image' | 'docx' | 'pdf' | 'other' | null;

export type { ChatState };
export type { WorkspaceState };
