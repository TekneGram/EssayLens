import type {
  AddBlockFeedbackRequest,
  AddInlineFeedbackRequest
} from '@/app/ports/assessment.port';
import type { ChatVocabularyFeedback } from '@/app/ports/chat.port';
import type { PendingSelection } from '@/layout/ChatInterface/domain';

export type VocabularyFeedbackDraft =
  | Omit<AddInlineFeedbackRequest, 'fileId'>
  | Omit<AddBlockFeedbackRequest, 'fileId'>;

export function formatVocabularyCommentText(vocabulary: ChatVocabularyFeedback): string {
  return `Here you used the word '${vocabulary.simpleVocabulary}'. To improve, you could use: '${vocabulary.preciseVocabulary}'.`;
}

/**
 * Builds the feedback draft for a vocabulary suggestion. When the `text_context`
 * was located in the document an inline draft (anchored to that text) is returned;
 * otherwise it degrades to a block draft so the feedback is never lost.
 */
export function buildVocabularyFeedbackDraft(
  vocabulary: ChatVocabularyFeedback,
  selection: PendingSelection | null
): VocabularyFeedbackDraft {
  const commentText = formatVocabularyCommentText(vocabulary);

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
