export interface SelectionRangeInfo {
  selection: Selection;
  range: Range;
}

export function getActiveWindowSelection(): SelectionRangeInfo | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  return {
    selection,
    range: selection.getRangeAt(0)
  };
}

export function clearWindowSelection() {
  window.getSelection()?.removeAllRanges();
}

export function addRangeToWindowSelection(range: Range) {
  window.getSelection()?.addRange(range);
}

export function findParagraph(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof HTMLElement && current.dataset.paragraphIndex) {
      return current;
    }
    current = current.parentNode;
  }
  return null;
}

export function getParagraphCharOffset(paragraph: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.setEnd(node, offset);
  return range.toString().length;
}
