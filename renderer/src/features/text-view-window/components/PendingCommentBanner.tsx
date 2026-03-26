import type { PendingSelection } from '@/layout/ChatInterface/domain';

interface PendingCommentBannerProps {
  pendingQuotePreview: string | null;
  pendingSelection: PendingSelection | null;
  onCancel: () => void;
}

export function PendingCommentBanner({ pendingQuotePreview, pendingSelection, onCancel }: PendingCommentBannerProps) {
  if (!pendingQuotePreview) {
    return null;
  }

  return (
    <div className="pending-comment-banner" role="status" aria-live="polite">
      <div className="pending-comment-banner-header">
        <strong>Pending Comment</strong>
        <button
          type="button"
          className="pending-comment-cancel"
          aria-label="Cancel pending comment"
          onClick={onCancel}
          title="Cancel pending comment"
        >
          x
        </button>
      </div>
      <p title={pendingSelection?.exactQuote}>{pendingQuotePreview}</p>
    </div>
  );
}
