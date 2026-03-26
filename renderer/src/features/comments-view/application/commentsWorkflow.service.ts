import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { CommandId, PendingSelection } from '@/layout/ChatInterface/domain';
import { toPendingSelectionFromComment, toSendToLlmActiveCommand } from '@/features/assessment-tab/domain/assessmentTab.logic';
import type { FeedbackItem } from '@/features/feedback/domain';

interface SubmitCommentFeedbackWorkflowParams {
  message: string;
  pendingSelection: PendingSelection | null;
  addFeedback: (request: Omit<AddInlineFeedbackRequest, 'fileId'> | Omit<AddBlockFeedbackRequest, 'fileId'>) => Promise<FeedbackItem>;
  onInlineSelectionCommitted: () => void;
}

export async function submitCommentFeedbackWorkflow({
  message,
  pendingSelection,
  addFeedback,
  onInlineSelectionCommitted
}: SubmitCommentFeedbackWorkflowParams): Promise<void> {
  if (pendingSelection) {
    await addFeedback({
      kind: 'inline',
      source: 'teacher',
      commentText: message,
      exactQuote: pendingSelection.exactQuote,
      prefixText: pendingSelection.prefixText,
      suffixText: pendingSelection.suffixText,
      startAnchor: pendingSelection.startAnchor,
      endAnchor: pendingSelection.endAnchor
    });
    onInlineSelectionCommitted();
    return;
  }

  await addFeedback({
    kind: 'block',
    source: 'teacher',
    commentText: message
  });
}

export function selectPendingSelectionFromComments(comments: FeedbackItem[], commentId: string): PendingSelection | null {
  const selectedComment = comments.find((comment) => comment.id === commentId);
  return toPendingSelectionFromComment(selectedComment);
}

interface EditCommentWorkflowParams {
  commentId: string;
  nextText: string;
  editFeedback: (request: { feedbackId: string; commentText: string }) => Promise<void>;
  refetchFeedback: () => Promise<unknown>;
}

export async function editCommentWorkflow({
  commentId,
  nextText,
  editFeedback,
  refetchFeedback
}: EditCommentWorkflowParams): Promise<void> {
  await editFeedback({ feedbackId: commentId, commentText: nextText });
  await refetchFeedback();
}

interface DeleteCommentWorkflowParams {
  commentId: string;
  deleteFeedback: (request: { feedbackId: string }) => Promise<void>;
  refetchFeedback: () => Promise<unknown>;
  onDeletedCommentId: (deletedCommentId: string) => void;
}

export async function deleteCommentWorkflow({
  commentId,
  deleteFeedback,
  refetchFeedback,
  onDeletedCommentId
}: DeleteCommentWorkflowParams): Promise<void> {
  await deleteFeedback({ feedbackId: commentId });
  onDeletedCommentId(commentId);
  await refetchFeedback();
}

interface ApplyCommentWorkflowParams {
  commentId: string;
  applied: boolean;
  applyFeedback: (request: { feedbackId: string; applied: boolean }) => Promise<void>;
  refetchFeedback: () => Promise<unknown>;
}

export async function applyCommentWorkflow({
  commentId,
  applied,
  applyFeedback,
  refetchFeedback
}: ApplyCommentWorkflowParams): Promise<void> {
  await applyFeedback({ feedbackId: commentId, applied });
  await refetchFeedback();
}

interface SendCommentToLlmWorkflowParams {
  commentId: string;
  commandId: CommandId | undefined;
  sendFeedbackToLlm: (request: { feedbackId: string; command?: string }) => Promise<void>;
  refetchFeedback: () => Promise<unknown>;
  onBeforeSend: (args: { commentId: string; commandId?: CommandId }) => void;
}

export async function sendCommentToLlmWorkflow({
  commentId,
  commandId,
  sendFeedbackToLlm,
  refetchFeedback,
  onBeforeSend
}: SendCommentToLlmWorkflowParams): Promise<void> {
  onBeforeSend({ commentId, commandId });
  await sendFeedbackToLlm({ feedbackId: commentId, command: commandId });
  await refetchFeedback();
}

export { toSendToLlmActiveCommand };
