import type { WordAnchor, WordTextMap } from '../../domain/textMapTypes';
import { anchorToParagraphOffset, paragraphOffsetToDomPosition } from './offsetTranslation';
import type { RenderBridge } from './types';

export function buildRangeFromAnchors(
  start: WordAnchor,
  end: WordAnchor,
  bridge: RenderBridge,
  textMap: WordTextMap
): Range | null {
  const startParagraph = textMap.paragraphs.find((item) => item.paragraphIndex === start.paragraphIndex);
  const endParagraph = textMap.paragraphs.find((item) => item.paragraphIndex === end.paragraphIndex);
  if (!startParagraph || !endParagraph) {
    return null;
  }

  const startEl = bridge.indexToParagraph.get(start.paragraphIndex);
  const endEl = bridge.indexToParagraph.get(end.paragraphIndex);
  if (!startEl || !endEl) {
    return null;
  }

  const startOffset = anchorToParagraphOffset(start, startParagraph);
  const endOffset = anchorToParagraphOffset(end, endParagraph);
  if (startOffset === null || endOffset === null) {
    return null;
  }

  const startPos = paragraphOffsetToDomPosition(startEl, startOffset);
  const endPos = paragraphOffsetToDomPosition(endEl, endOffset);
  if (!startPos || !endPos) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}
