import type { ActiveCommand, ChatMode, PendingSelection } from '@/layout/ChatInterface/domain';

export interface AssessmentTabLocalState {
  pendingSelection: PendingSelection | null;
  activeCommentSelection: PendingSelection | null;
  activeCommand: ActiveCommand | null;
  chatMode: ChatMode;
  activeCommentId: string | null;
  draftText: string;
}
