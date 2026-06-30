import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { ChatInlineCommentPayload } from '@/app/ports/chat.port';
import type { PendingSelection } from '@/layout/ChatInterface/domain';

export type ChatInlineCommentDraft =
  | Omit<AddInlineFeedbackRequest, 'fileId'>
  | Omit<AddBlockFeedbackRequest, 'fileId'>;

export function buildChatInlineCommentDraft(
  payload: ChatInlineCommentPayload,
  selection: PendingSelection | null
): ChatInlineCommentDraft {
  const commentText = payload.commentText.trim();

  if (selection) {
    return {
      kind: 'inline',
      source: 'llm',
      commentText,
      exactQuote: selection.exactQuote,
      prefixText: selection.prefixText,
      suffixText: selection.suffixText,
      startAnchor: selection.startAnchor,
      endAnchor: selection.endAnchor
    };
  }

  return {
    kind: 'block',
    source: 'llm',
    commentText
  };
}
