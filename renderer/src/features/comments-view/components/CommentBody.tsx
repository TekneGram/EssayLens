import type { CommentBodyProps } from '@/features/assessment-tab/types';
import { truncateText } from '../domain/commentBody.logic';

export function CommentBody({ comment, quotePreviewLength = 120 }: CommentBodyProps) {
  const preview = comment.kind === 'inline' ? truncateText(comment.exactQuote, quotePreviewLength) : '';

  return (
    <section className="comment-body">
      {comment.kind === 'inline' ? (
        <p className="comment-quote-preview" title={comment.exactQuote}>
          <strong>Quote:</strong> {preview}
        </p>
      ) : null}
      <p className="comment-text">{comment.commentText}</p>
    </section>
  );
}
