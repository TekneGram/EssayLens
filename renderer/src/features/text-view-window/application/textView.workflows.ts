import type { PendingSelection } from '@/layout/ChatInterface/domain';
import { clipContext, normalizeWhitespace } from '../domain/textView.logic';
import { findParagraph, getParagraphCharOffset } from '../adapters/windowSelection';

export function toFallbackPendingSelection(args: { range: Range; text: string }): PendingSelection | null {
  const exactQuote = normalizeWhitespace(args.range.toString());
  if (!exactQuote) {
    return null;
  }

  const startParagraph = findParagraph(args.range.startContainer);
  const endParagraph = findParagraph(args.range.endContainer);
  if (!startParagraph || !endParagraph) {
    return null;
  }

  const startParagraphIndex = Number(startParagraph.dataset.paragraphIndex);
  const endParagraphIndex = Number(endParagraph.dataset.paragraphIndex);
  if (Number.isNaN(startParagraphIndex) || Number.isNaN(endParagraphIndex)) {
    return null;
  }

  return {
    exactQuote,
    prefixText: clipContext(args.text, exactQuote, 'prefix'),
    suffixText: clipContext(args.text, exactQuote, 'suffix'),
    startAnchor: {
      part: 'renderer://original-text-view',
      paragraphIndex: startParagraphIndex,
      runIndex: 0,
      charOffset: getParagraphCharOffset(startParagraph, args.range.startContainer, args.range.startOffset)
    },
    endAnchor: {
      part: 'renderer://original-text-view',
      paragraphIndex: endParagraphIndex,
      runIndex: 0,
      charOffset: getParagraphCharOffset(endParagraph, args.range.endContainer, args.range.endOffset)
    }
  };
}
