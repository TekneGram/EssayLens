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

export function useTextViewFocus({
  activeCommentId,
  activeCommentSelection,
  document,
  bridgeRef
}: UseTextViewFocusArgs): void {
  useEffect(() => {
    if (!activeCommentId || !activeCommentSelection || !document || !bridgeRef.current) {
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

    clearWindowSelection();
    addRangeToWindowSelection(range);
    range.startContainer.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeCommentId, activeCommentSelection, bridgeRef, document]);
}
