import type { WordAnchor, WordParagraphUnit } from '../../domain/textMapTypes';
import type { NodePosition } from './types';

export function resolveTextPosition(node: Node, offset: number): NodePosition | null {
  if (node.nodeType === 3) {
    const textNode = node as Text;
    return {
      node: textNode,
      offset: Math.max(0, Math.min(offset, textNode.nodeValue?.length ?? 0))
    };
  }

  if (node.nodeType !== 1) {
    return null;
  }

  const el = node as Element;
  const child = el.childNodes[offset] ?? el.childNodes[Math.max(0, offset - 1)];
  if (!child) {
    return null;
  }

  if (child.nodeType === 3) {
    return { node: child as Text, offset: 0 };
  }

  const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
  const textNode = walker.nextNode() as Text | null;
  if (!textNode) {
    return null;
  }
  return { node: textNode, offset: 0 };
}

export function paragraphOffsetFromPosition(paragraphEl: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(paragraphEl);
  range.setEnd(node, offset);
  return range.toString().length;
}

export function paragraphOffsetToAnchor(paragraph: WordParagraphUnit, offset: number): WordAnchor | null {
  const bounded = Math.max(0, Math.min(offset, paragraph.totalLength));

  if (paragraph.units.length === 0) {
    return null;
  }

  if (bounded === paragraph.totalLength) {
    const last = paragraph.units[paragraph.units.length - 1];
    return {
      part: last.part,
      paragraphIndex: last.paragraphIndex,
      runIndex: last.runIndex,
      charOffset: last.text.length
    };
  }

  for (const unit of paragraph.units) {
    const start = unit.globalStart - paragraph.units[0].globalStart;
    const end = start + unit.text.length;
    if (bounded >= start && bounded < end) {
      return {
        part: unit.part,
        paragraphIndex: unit.paragraphIndex,
        runIndex: unit.runIndex,
        charOffset: bounded - start
      };
    }
  }

  const fallback = paragraph.units[paragraph.units.length - 1];
  return {
    part: fallback.part,
    paragraphIndex: fallback.paragraphIndex,
    runIndex: fallback.runIndex,
    charOffset: fallback.text.length
  };
}

export function anchorToParagraphOffset(anchor: WordAnchor, paragraph: WordParagraphUnit): number | null {
  let base = 0;
  for (const unit of paragraph.units) {
    if (
      unit.part === anchor.part &&
      unit.paragraphIndex === anchor.paragraphIndex &&
      unit.runIndex === anchor.runIndex
    ) {
      return base + Math.max(0, Math.min(anchor.charOffset, unit.text.length));
    }
    base += unit.text.length;
  }
  return null;
}

export function paragraphOffsetToDomPosition(paragraphEl: HTMLElement, targetOffset: number): NodePosition | null {
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT);
  let consumed = 0;

  let current = walker.nextNode();
  while (current) {
    const node = current as Text;
    const value = node.nodeValue ?? '';
    const end = consumed + value.length;

    if (targetOffset <= end) {
      return {
        node,
        offset: Math.max(0, Math.min(value.length, targetOffset - consumed))
      };
    }

    consumed = end;
    current = walker.nextNode();
  }

  return null;
}
