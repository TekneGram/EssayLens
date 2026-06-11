import { describe, expect, it } from 'vitest';
import { resolveInlineSelectionFromText } from '../inlineSelection.workflow';
import type { WordTextMap, WordParagraphUnit } from '../../domain/textMapTypes';

const PART = 'word/document.xml';

function buildTextMap(paragraphTexts: string[]): WordTextMap {
  let globalOffset = 0;
  const paragraphs: WordParagraphUnit[] = paragraphTexts.map((text, paragraphIndex) => {
    const unit = {
      part: PART,
      paragraphIndex,
      runIndex: 0,
      text,
      globalStart: globalOffset,
      globalEnd: globalOffset + text.length
    };
    globalOffset += text.length + 1;
    return {
      part: PART,
      paragraphIndex,
      text,
      units: [unit],
      totalLength: text.length
    };
  });
  return { paragraphs, part: PART };
}

describe('resolveInlineSelectionFromText', () => {
  it('resolves an exact substring match into anchors and context', () => {
    const textMap = buildTextMap(['The dog was good today.', 'Another paragraph here.']);

    const selection = resolveInlineSelectionFromText(textMap, 'good');

    expect(selection).not.toBeNull();
    expect(selection?.exactQuote).toBe('good');
    expect(selection?.startAnchor).toEqual({ part: PART, paragraphIndex: 0, runIndex: 0, charOffset: 12 });
    expect(selection?.endAnchor).toEqual({ part: PART, paragraphIndex: 0, runIndex: 0, charOffset: 16 });
    expect(selection?.prefixText).toBe('The dog was');
    expect(selection?.suffixText).toBe('today.');
  });

  it('matches across the correct paragraph index', () => {
    const textMap = buildTextMap(['First paragraph.', 'The student wrote stuff here.']);

    const selection = resolveInlineSelectionFromText(textMap, 'stuff');

    expect(selection?.startAnchor.paragraphIndex).toBe(1);
    expect(selection?.exactQuote).toBe('stuff');
  });

  it('tolerates whitespace differences between the search text and the document', () => {
    const textMap = buildTextMap(['The cat   sat on the mat.']);

    const selection = resolveInlineSelectionFromText(textMap, 'cat sat');

    expect(selection).not.toBeNull();
    expect(selection?.exactQuote).toBe('cat sat');
    expect(selection?.startAnchor.charOffset).toBe(4);
  });

  it('returns null when the text cannot be located', () => {
    const textMap = buildTextMap(['Nothing relevant in here.']);

    expect(resolveInlineSelectionFromText(textMap, 'absent phrase')).toBeNull();
  });

  it('returns null for empty search text', () => {
    const textMap = buildTextMap(['Some text.']);

    expect(resolveInlineSelectionFromText(textMap, '   ')).toBeNull();
  });
});
