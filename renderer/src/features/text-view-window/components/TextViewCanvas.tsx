import type { CSSProperties, RefObject } from 'react';

interface TextViewCanvasProps {
  zoomLevel: number;
  text: string;
  hasDocument: boolean;
  paragraphs: string[];
  stageLayout: { width: number; height: number; gutter: number };
  baseDocxSize: { width: number; height: number };
  windowRef: RefObject<HTMLDivElement>;
  zoomContentRef: RefObject<HTMLDivElement>;
  containerRef: RefObject<HTMLDivElement>;
  onCaptureSelection: () => void;
}

export function TextViewCanvas({
  zoomLevel,
  text,
  hasDocument,
  paragraphs,
  stageLayout,
  baseDocxSize,
  windowRef,
  zoomContentRef,
  containerRef,
  onCaptureSelection
}: TextViewCanvasProps) {
  return (
    <div
      ref={windowRef}
      className="content-block text-view-window"
      style={{ '--docx-zoom': `${zoomLevel}` } as CSSProperties}
      data-testid="text-view-window"
      onMouseUp={onCaptureSelection}
      onKeyUp={onCaptureSelection}
    >
      {hasDocument ? (
        <div
          className="docx-zoom-stage"
          style={
            {
              width: stageLayout.width > 0 ? `${stageLayout.width}px` : undefined,
              height: stageLayout.height > 0 ? `${stageLayout.height}px` : undefined,
              paddingInline: `${stageLayout.gutter}px`
            } as CSSProperties
          }
        >
          <div
            ref={zoomContentRef}
            className="docx-zoom-content"
            style={
              {
                width: baseDocxSize.width > 0 ? `${baseDocxSize.width}px` : undefined
              } as CSSProperties
            }
          >
            <div ref={containerRef} className="docx-host" />
          </div>
        </div>
      ) : null}
      {!hasDocument
        ? paragraphs.length > 0
          ? paragraphs.map((paragraph, index) => (
              <p key={`${paragraph.slice(0, 24)}-${index}`} data-paragraph-index={index}>
                {paragraph}
              </p>
            ))
          : text
        : null}
    </div>
  );
}
