import { describe, expect, it } from 'vitest';
import { toPendingSelectionFromTextContext } from './textView.workflows';
import type { WordTextMap } from '../domain';

function createTextMap(text: string): WordTextMap {
  return {
    part: 'word/document.xml',
    paragraphs: [
      {
        part: 'word/document.xml',
        paragraphIndex: 0,
        text,
        totalLength: text.length,
        units: [
          {
            part: 'word/document.xml',
            paragraphIndex: 0,
            runIndex: 0,
            text,
            globalStart: 0,
            globalEnd: text.length
          }
        ]
      }
    ]
  };
}

describe('textView.workflows', () => {
  it('creates a pending selection from a unique exact text-context match', () => {
    const selection = toPendingSelectionFromTextContext({
      textContext: 'good plan',
      textMap: createTextMap('This is a good plan for students.')
    });

    expect(selection).toEqual({
      exactQuote: 'good plan',
      prefixText: 'This is a ',
      suffixText: ' for students.',
      startAnchor: {
        part: 'word/document.xml',
        paragraphIndex: 0,
        runIndex: 0,
        charOffset: 10
      },
      endAnchor: {
        part: 'word/document.xml',
        paragraphIndex: 0,
        runIndex: 0,
        charOffset: 19
      }
    });
  });

  it('returns null when the text-context is duplicated', () => {
    const selection = toPendingSelectionFromTextContext({
      textContext: 'good',
      textMap: createTextMap('good writing uses good detail')
    });

    expect(selection).toBeNull();
  });
});
