import { describe, expect, it } from 'vitest';
import {
  buildVocabularyFeedbackDraft,
  formatVocabularyCommentText
} from '../vocabularyInlineComment';
import type { PendingSelection } from '@/layout/ChatInterface/domain';

const vocabulary = {
  simpleVocabulary: 'good',
  textContext: 'It was good today.',
  preciseVocabulary: 'exemplary'
};

const selection: PendingSelection = {
  exactQuote: 'good',
  prefixText: 'It was',
  suffixText: 'today.',
  startAnchor: { part: 'word/document.xml', paragraphIndex: 0, runIndex: 0, charOffset: 7 },
  endAnchor: { part: 'word/document.xml', paragraphIndex: 0, runIndex: 0, charOffset: 11 }
};

describe('vocabularyInlineComment', () => {
  it('formats the comment text with the simple and precise words', () => {
    expect(formatVocabularyCommentText(vocabulary)).toBe(
      "Here you used the word 'good'. To improve, you could use: 'exemplary'."
    );
  });

  it('builds an inline draft anchored to the located selection', () => {
    expect(buildVocabularyFeedbackDraft(vocabulary, selection)).toEqual({
      kind: 'inline',
      source: 'llm',
      commentText: "Here you used the word 'good'. To improve, you could use: 'exemplary'.",
      exactQuote: 'good',
      prefixText: 'It was',
      suffixText: 'today.',
      startAnchor: selection.startAnchor,
      endAnchor: selection.endAnchor
    });
  });

  it('falls back to a block draft when the text was not located', () => {
    expect(buildVocabularyFeedbackDraft(vocabulary, null)).toEqual({
      kind: 'block',
      source: 'llm',
      commentText: "Here you used the word 'good'. To improve, you could use: 'exemplary'."
    });
  });
});
