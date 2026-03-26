import { useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { PendingSelection } from '@/layout/ChatInterface/domain';
import type { LoadedTextViewDocument } from './useTextViewDocument';
import { getActiveWindowSelection, selectionToAnchors, type RenderBridge } from '../adapters';

interface UseTextViewSelectionArgs {
  document: LoadedTextViewDocument | null;
  bridgeRef: MutableRefObject<RenderBridge | null>;
  onSelectionCaptured: (selection: PendingSelection | null) => void;
}

function getRangePreview(range: Range): { quote: string; prefix: string; suffix: string } {
  const quote = range.toString().replace(/\s+/g, ' ').trim();
  const startText = range.startContainer.textContent ?? '';
  const endText = range.endContainer.textContent ?? '';

  return {
    quote,
    prefix: startText.slice(Math.max(0, range.startOffset - 40), range.startOffset),
    suffix: endText.slice(range.endOffset, Math.min(endText.length, range.endOffset + 40))
  };
}

export function useTextViewSelection({
  document,
  bridgeRef,
  onSelectionCaptured
}: UseTextViewSelectionArgs): { captureSelection: () => void } {
  const captureSelection = useCallback(() => {
    if (!document || !bridgeRef.current) {
      onSelectionCaptured(null);
      return;
    }

    const activeSelection = getActiveWindowSelection();
    if (!activeSelection) {
      onSelectionCaptured(null);
      return;
    }

    const anchors = selectionToAnchors(activeSelection.selection, bridgeRef.current, document.textMap);
    if (!anchors) {
      onSelectionCaptured(null);
      return;
    }

    const preview = getRangePreview(activeSelection.range);
    if (!preview.quote) {
      onSelectionCaptured(null);
      return;
    }

    onSelectionCaptured({
      exactQuote: preview.quote,
      prefixText: preview.prefix,
      suffixText: preview.suffix,
      startAnchor: anchors.start,
      endAnchor: anchors.end
    });
  }, [bridgeRef, document, onSelectionCaptured]);

  return { captureSelection };
}
