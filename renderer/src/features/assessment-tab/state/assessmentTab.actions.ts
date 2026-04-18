import type { ActiveCommand, ChatMode, PendingSelection } from '@/layout/ChatInterface/domain';

export type AssessmentTabAction =
  | { type: 'assessmentTab/setPendingSelection'; payload: PendingSelection | null }
  | { type: 'assessmentTab/setActiveCommentSelection'; payload: PendingSelection | null }
  | { type: 'assessmentTab/setActiveCommand'; payload: ActiveCommand | null }
  | { type: 'assessmentTab/clearActiveCommentIfMatch'; payload: string }
  | { type: 'assessmentTab/setChatMode'; payload: ChatMode }
  | { type: 'assessmentTab/setActiveCommentId'; payload: string | null }
  | { type: 'assessmentTab/setDraftText'; payload: string };
