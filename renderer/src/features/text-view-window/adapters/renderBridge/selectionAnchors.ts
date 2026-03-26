import type { WordAnchor, WordTextMap } from '../../domain/textMapTypes';
import { findMappedParagraphElement } from './paragraphMapping';
import { paragraphOffsetFromPosition, paragraphOffsetToAnchor, resolveTextPosition } from './offsetTranslation';
import type { RenderBridge } from './types';

function positionToAnchor(node: Node, offset: number, bridge: RenderBridge, textMap: WordTextMap): WordAnchor | null {
  const textPosition = resolveTextPosition(node, offset);
  if (!textPosition) {
    return null;
  }

  const paragraphEl = findMappedParagraphElement(textPosition.node, bridge);
  if (!paragraphEl) {
    return null;
  }

  const paragraphIndex = bridge.paragraphToIndex.get(paragraphEl);
  if (paragraphIndex === undefined) {
    return null;
  }

  const paragraph = textMap.paragraphs.find((item) => item.paragraphIndex === paragraphIndex);
  if (!paragraph) {
    return null;
  }

  const paragraphOffset = paragraphOffsetFromPosition(paragraphEl, textPosition.node, textPosition.offset);
  return paragraphOffsetToAnchor(paragraph, paragraphOffset);
}

export function selectionToAnchors(
  selection: Selection,
  bridge: RenderBridge,
  textMap: WordTextMap
): {
  start: WordAnchor;
  end: WordAnchor;
} | null {
  if (selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return null;
  }

  const start = positionToAnchor(range.startContainer, range.startOffset, bridge, textMap);
  const end = positionToAnchor(range.endContainer, range.endOffset, bridge, textMap);

  if (!start || !end) {
    return null;
  }

  return { start, end };
}
