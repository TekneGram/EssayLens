import type { PendingSelection } from '../domain';

interface HighlightedTextDisplayProps {
  pendingSelection?: PendingSelection | null;
}

export function HighlightedTextDisplay({ pendingSelection = null }: HighlightedTextDisplayProps) {
  const quote = pendingSelection?.exactQuote;
  const preview = quote ? (quote.length > 120 ? `${quote.slice(0, 120)}…` : quote) : null;

  if (!preview) {
    return null;
  }

  return (
    <div className="chat-highlighted-text" data-testid="highlighted-text-stub" title={quote ?? undefined}>
      {preview}
    </div>
  );
}
