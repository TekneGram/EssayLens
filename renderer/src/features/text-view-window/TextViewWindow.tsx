import { useEffect, useRef } from 'react';
import type { PendingSelection } from '@/features/assessment-tab/types';
import { toFallbackPendingSelection } from './application/textView.workflows';
import { PendingCommentBanner } from './components/PendingCommentBanner';
import { TextViewCanvas } from './components/TextViewCanvas';
import { TextViewToolbar } from './components/TextViewToolbar';
import { buildPendingQuotePreview } from './domain/textView.logic';
import { clearWindowSelection, getActiveWindowSelection } from './adapters/windowSelection';
import { useTextViewDocxLayout } from './hooks/useTextViewDocxLayout';
import { useTextViewDocument } from './hooks/useTextViewDocument';
import { useTextViewFocus } from './hooks/useTextViewFocus';
import { useTextViewSelection } from './hooks/useTextViewSelection';
import { useTextViewWindowState } from './hooks/useTextViewWindowState';

interface TextViewWindowProps {
  selectedFileId: string | null;
  text: string;
  pendingSelection?: PendingSelection | null;
  activeCommentSelection?: PendingSelection | null;
  activeCommentId?: string | null;
  onSelectionCaptured: (selection: PendingSelection | null) => void;
  onDocumentTextChange?: (text: string | null) => void;
}

const MIN_ZOOM_PERCENT = 60;
const MAX_ZOOM_PERCENT = 140;
const ZOOM_STEP_PERCENT = 5;
const DEFAULT_ZOOM_PERCENT = 100;
const MIN_STAGE_GUTTER = 24;

export function TextViewWindow({
  selectedFileId,
  text,
  pendingSelection = null,
  activeCommentSelection = null,
  activeCommentId = null,
  onSelectionCaptured,
  onDocumentTextChange
}: TextViewWindowProps) {
  const paragraphs = text.split(/\n+/).filter((paragraph) => paragraph.trim().length > 0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zoomContentRef = useRef<HTMLDivElement | null>(null);
  const windowRef = useRef<HTMLDivElement | null>(null);
  const previousFocusedParagraph = useRef<HTMLElement | null>(null);
  const previousStageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const { zoomLevel, zoomPercent, baseDocxSize, stageLayout, setZoomPercent, resetZoom, resetLayout, setBaseDocxSize, setStageLayout } =
    useTextViewWindowState({
      minZoomPercent: MIN_ZOOM_PERCENT,
      maxZoomPercent: MAX_ZOOM_PERCENT,
      defaultZoomPercent: DEFAULT_ZOOM_PERCENT,
      minStageGutter: MIN_STAGE_GUTTER
    });

  const { document, bridgeRef } = useTextViewDocument({
    selectedFileId,
    containerRef,
    onSelectionCleared: () => onSelectionCaptured(null),
    onDocumentTextChange
  });

  useTextViewDocxLayout({
    document,
    selectedFileId,
    zoomLevel,
    baseDocxSize,
    stageLayout,
    minStageGutter: MIN_STAGE_GUTTER,
    containerRef,
    zoomContentRef,
    windowRef,
    previousStageSizeRef,
    onResetLayout: resetLayout,
    onBaseDocxSizeChange: setBaseDocxSize,
    onStageLayoutChange: setStageLayout
  });

  const { captureSelection } = useTextViewSelection({
    document,
    bridgeRef,
    onSelectionCaptured
  });

  useTextViewFocus({
    activeCommentId,
    activeCommentSelection,
    document,
    bridgeRef
  });

  useEffect(() => {
    const root = windowRef.current;
    if (!root || document || !activeCommentId || !activeCommentSelection) {
      return;
    }

    const startIndex = activeCommentSelection.startAnchor.paragraphIndex;
    const startParagraph = root.querySelector<HTMLElement>(`[data-paragraph-index="${startIndex}"]`);
    if (!startParagraph) {
      return;
    }

    if (previousFocusedParagraph.current && previousFocusedParagraph.current !== startParagraph) {
      previousFocusedParagraph.current.classList.remove('text-paragraph-focused');
    }
    startParagraph.classList.add('text-paragraph-focused');
    previousFocusedParagraph.current = startParagraph;
    if (typeof startParagraph.scrollIntoView === 'function') {
      startParagraph.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeCommentId, activeCommentSelection, document]);

  const captureFallbackSelection = () => {
    const activeSelection = getActiveWindowSelection();
    if (!activeSelection) {
      onSelectionCaptured(null);
      return;
    }
    onSelectionCaptured(toFallbackPendingSelection({ range: activeSelection.range, text }));
  };

  const captureCurrentSelection = () => {
    if (document) {
      captureSelection();
      return;
    }
    captureFallbackSelection();
  };

  const cancelPendingComment = () => {
    onSelectionCaptured(null);
    clearWindowSelection();
  };

  const pendingQuotePreview = buildPendingQuotePreview(pendingSelection?.exactQuote);

  return (
    <div className="text-view-shell">
      <TextViewToolbar
        zoomPercent={zoomPercent}
        minZoomPercent={MIN_ZOOM_PERCENT}
        maxZoomPercent={MAX_ZOOM_PERCENT}
        stepPercent={ZOOM_STEP_PERCENT}
        defaultZoomPercent={DEFAULT_ZOOM_PERCENT}
        canControlZoom={Boolean(document)}
        onZoomChange={setZoomPercent}
        onResetZoom={resetZoom}
      />
      <TextViewCanvas
        zoomLevel={zoomLevel}
        text={text}
        hasDocument={Boolean(document)}
        paragraphs={paragraphs}
        stageLayout={stageLayout}
        baseDocxSize={baseDocxSize}
        windowRef={windowRef}
        zoomContentRef={zoomContentRef}
        containerRef={containerRef}
        onCaptureSelection={captureCurrentSelection}
      />
      <PendingCommentBanner pendingQuotePreview={pendingQuotePreview} pendingSelection={pendingSelection} onCancel={cancelPendingComment} />
    </div>
  );
}
