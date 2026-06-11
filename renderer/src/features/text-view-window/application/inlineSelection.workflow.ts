import type { PendingSelection } from '@/layout/ChatInterface/domain';
import type { WordTextMap } from '../domain/textMapTypes';
import { normalizeWhitespace } from '../domain/textView.logic';
import { paragraphOffsetToAnchor } from '../adapters/renderBridge/offsetTranslation';

const CONTEXT_BOUNDARY = 40;

/**
 * Builds a {@link PendingSelection} for the first paragraph that contains
 * `searchText`, without requiring a live DOM selection. Used to turn LLM-provided
 * text (e.g. a vocabulary `text_context`) into an inline comment anchor.
 *
 * Matching first tries an exact substring match, then falls back to a
 * whitespace-tolerant match so minor run/whitespace differences between the
 * extracted text and the rendered document still resolve.
 */
export function resolveInlineSelectionFromText(
  textMap: WordTextMap,
  searchText: string
): PendingSelection | null {
  const target = typeof searchText === 'string' ? searchText.trim() : '';
  if (!target) {
    return null;
  }

  for (const paragraph of textMap.paragraphs) {
    const match = findMatch(paragraph.text, target);
    if (!match) {
      continue;
    }

    const startAnchor = paragraphOffsetToAnchor(paragraph, match.start);
    const endAnchor = paragraphOffsetToAnchor(paragraph, match.end);
    if (!startAnchor || !endAnchor) {
      continue;
    }

    const exactQuote = normalizeWhitespace(paragraph.text.slice(match.start, match.end));
    if (!exactQuote) {
      continue;
    }

    return {
      exactQuote,
      prefixText: normalizeWhitespace(
        paragraph.text.slice(Math.max(0, match.start - CONTEXT_BOUNDARY), match.start)
      ),
      suffixText: normalizeWhitespace(
        paragraph.text.slice(match.end, Math.min(paragraph.text.length, match.end + CONTEXT_BOUNDARY))
      ),
      startAnchor,
      endAnchor
    };
  }

  return null;
}

function findMatch(rawText: string, target: string): { start: number; end: number } | null {
  const directIndex = rawText.indexOf(target);
  if (directIndex >= 0) {
    return { start: directIndex, end: directIndex + target.length };
  }

  const normalizedTarget = normalizeWhitespace(target);
  if (!normalizedTarget) {
    return null;
  }

  for (let start = 0; start < rawText.length; start += 1) {
    if (isWhitespace(rawText[start])) {
      continue;
    }
    const end = matchIgnoringWhitespace(rawText, start, normalizedTarget);
    if (end !== null) {
      return { start, end };
    }
  }

  return null;
}

function matchIgnoringWhitespace(rawText: string, start: number, normalizedTarget: string): number | null {
  let rawIndex = start;
  let targetIndex = 0;

  while (targetIndex < normalizedTarget.length) {
    if (rawIndex >= rawText.length) {
      return null;
    }

    const targetChar = normalizedTarget[targetIndex];
    if (targetChar === ' ') {
      if (!isWhitespace(rawText[rawIndex])) {
        return null;
      }
      while (rawIndex < rawText.length && isWhitespace(rawText[rawIndex])) {
        rawIndex += 1;
      }
      targetIndex += 1;
      continue;
    }

    if (rawText[rawIndex] !== targetChar) {
      return null;
    }
    rawIndex += 1;
    targetIndex += 1;
  }

  return rawIndex;
}

function isWhitespace(char: string | undefined): boolean {
  return typeof char === 'string' && /\s/.test(char);
}
