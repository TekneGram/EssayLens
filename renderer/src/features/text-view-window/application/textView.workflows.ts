import type { PendingSelection } from '@/layout/ChatInterface/domain';
import { clipContext, normalizeWhitespace } from '../domain/textView.logic';
import type { WordTextMap } from '../domain/textMapTypes';
import { paragraphOffsetToAnchor } from '../adapters/renderBridge/offsetTranslation';
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

export function toPendingSelectionFromTextContext(args: {
  textContext: string;
  textMap: WordTextMap;
}): PendingSelection | null {
  const exactQuote = args.textContext.trim();
  if (!exactQuote) {
    return null;
  }

  const fullText = args.textMap.paragraphs.map((paragraph) => paragraph.text).join('\n');
  const startIndex = fullText.indexOf(exactQuote);
  if (startIndex < 0) {
    return null;
  }
  if (fullText.indexOf(exactQuote, startIndex + exactQuote.length) >= 0) {
    return null;
  }

  const endIndex = startIndex + exactQuote.length;
  const startAnchor = globalOffsetToAnchor(args.textMap, startIndex);
  const endAnchor = globalOffsetToAnchor(args.textMap, endIndex);
  if (!startAnchor || !endAnchor) {
    return null;
  }

  const boundary = 40;
  return {
    exactQuote,
    prefixText: fullText.slice(Math.max(0, startIndex - boundary), startIndex),
    suffixText: fullText.slice(endIndex, Math.min(fullText.length, endIndex + boundary)),
    startAnchor,
    endAnchor
  };
}

function globalOffsetToAnchor(textMap: WordTextMap, targetOffset: number) {
  let paragraphStart = 0;

  for (const paragraph of textMap.paragraphs) {
    const paragraphEnd = paragraphStart + paragraph.text.length;
    if (targetOffset <= paragraphEnd) {
      return paragraphOffsetToAnchor(paragraph, targetOffset - paragraphStart);
    }
    paragraphStart = paragraphEnd + 1;
  }

  return null;
}
