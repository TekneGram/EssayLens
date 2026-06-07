import type {
  ActiveCommand,
  ChatInterfaceBindings,
  ChatMode,
  CommandId,
  PendingSelection
} from '@/layout/ChatInterface/domain';
import type { FeedbackItem } from '@/features/feedback/domain';
import type { EntityId } from '@/app/types/primitives';
import type { WordTextMap } from '@/features/text-view-window';

export interface OriginalTextViewProps {
  selectedFileId: EntityId | null;
  text: string;
  pendingSelection: PendingSelection | null;
  activeCommentSelection: PendingSelection | null;
  activeCommentId: string | null;
  onSelectionCaptured: (selection: PendingSelection | null) => void;
  onDocumentTextChange?: (text: string | null) => void;
  onDocumentTextMapChange?: (textMap: WordTextMap | null) => void;
}

export interface CommentsViewProps {
  comments: FeedbackItem[];
  activeCommentId: string | null;
  isLoading: boolean;
  isGeneratePending: boolean;
  canGenerateFeedbackDocument: boolean;
  error?: string;
  onSelectComment: (commentId: string) => void;
  onEditComment: (commentId: string, nextText: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSendToLlm: (commentId: string, command?: CommandId) => void;
  onApplyComment: (commentId: string, applied: boolean) => void;
  onApplyAllComments: () => void;
  onGenerateFeedbackDocument: () => void;
}

export interface CommentViewProps {
  comment: FeedbackItem;
  isActive: boolean;
  onSelectComment: (commentId: string) => void;
  onEditComment: (commentId: string, nextText: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSendToLlm: (commentId: string, command?: CommandId) => void;
  onApplyComment: (commentId: string, applied: boolean) => void;
}

export interface CommentHeaderProps {
  comment: FeedbackItem;
  title: string;
  isActive: boolean;
}

export interface CommentBodyProps {
  comment: FeedbackItem;
  quotePreviewLength?: number;
}

export interface CommentToolsProps {
  commentId: string;
  commentText: string;
  applied: boolean;
  onEditComment: (commentId: string, nextText: string) => void;
  onDeleteComment: (commentId: string) => void;
  onSendToLlm: (commentId: string, command?: CommandId) => void;
  onApplyComment: (commentId: string, applied: boolean) => void;
}

export type AssessmentTabChatBindings = ChatInterfaceBindings;
export type { ActiveCommand, ChatMode, CommandId, PendingSelection };
