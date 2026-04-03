import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { PendingSelection } from '@/layout/ChatInterface/domain';
import { addRangeToWindowSelection, buildRangeFromAnchors, clearWindowSelection, type RenderBridge } from '../adapters';
import type { LoadedTextViewDocument } from './useTextViewDocument';

interface UseTextViewFocusArgs {
  activeCommentId: string | null;
  activeCommentSelection: PendingSelection | null;
  document: LoadedTextViewDocument | null;
  bridgeRef: MutableRefObject<RenderBridge | null>;
}

const ACTIVE_COMMENT_HIGHLIGHT_NAME = 'essaylens-active-comment';

interface CustomHighlightRegistry {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
}

interface CustomHighlightSupport {
  CSS?: { highlights?: CustomHighlightRegistry };
  Highlight?: new (...ranges: Range[]) => unknown;
}

export function useTextViewFocus({
  activeCommentId,
  activeCommentSelection,
  document,
  bridgeRef
}: UseTextViewFocusArgs): void {
  useEffect(() => {
    if (!activeCommentId || !activeCommentSelection || !document || !bridgeRef.current) {
      const highlightSupport = globalThis as typeof globalThis & CustomHighlightSupport;
      highlightSupport.CSS?.highlights?.delete(ACTIVE_COMMENT_HIGHLIGHT_NAME);
      return;
    }

    const range = buildRangeFromAnchors(
      activeCommentSelection.startAnchor,
      activeCommentSelection.endAnchor,
      bridgeRef.current,
      document.textMap
    );

    if (!range) {
      return;
    }

    const highlightSupport = globalThis as typeof globalThis & CustomHighlightSupport;
    if (highlightSupport.CSS?.highlights && highlightSupport.Highlight) {
      highlightSupport.CSS.highlights.set(ACTIVE_COMMENT_HIGHLIGHT_NAME, new highlightSupport.Highlight(range));
    } else {
      clearWindowSelection();
      addRangeToWindowSelection(range);
    }
    range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return () => {
      highlightSupport.CSS?.highlights?.delete(ACTIVE_COMMENT_HIGHLIGHT_NAME);
    };
  }, [activeCommentId, activeCommentSelection, bridgeRef, document]);
}
