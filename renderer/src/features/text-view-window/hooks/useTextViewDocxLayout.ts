import { useEffect, type MutableRefObject, type RefObject } from 'react';
import type { LoadedTextViewDocument } from './useTextViewDocument';

interface StageLayout {
  width: number;
  height: number;
  gutter: number;
}

interface DocxSize {
  width: number;
  height: number;
}

interface UseTextViewDocxLayoutArgs {
  document: LoadedTextViewDocument | null;
  selectedFileId: string | null;
  zoomLevel: number;
  baseDocxSize: DocxSize;
  stageLayout: StageLayout;
  minStageGutter: number;
  containerRef: RefObject<HTMLDivElement>;
  zoomContentRef: RefObject<HTMLDivElement>;
  windowRef: RefObject<HTMLDivElement>;
  previousStageSizeRef: MutableRefObject<{ width: number; height: number } | null>;
  onResetLayout: () => void;
  onBaseDocxSizeChange: (width: number, height: number) => void;
  onStageLayoutChange: (width: number, height: number, gutter: number) => void;
}

export function useTextViewDocxLayout(args: UseTextViewDocxLayoutArgs) {
  useEffect(() => {
    args.onResetLayout();
    args.previousStageSizeRef.current = null;
  }, [args.selectedFileId]);

  useEffect(() => {
    if (!args.document || !args.containerRef.current) {
      return;
    }

    const host = args.containerRef.current;
    const measure = () => {
      const wrapper = host.querySelector<HTMLElement>('.docx-wrapper');
      if (!wrapper) {
        return;
      }
      const width = Math.ceil(Math.max(wrapper.scrollWidth, wrapper.offsetWidth));
      const height = Math.ceil(Math.max(wrapper.scrollHeight, wrapper.offsetHeight));
      if (width > 0 && height > 0) {
        args.onBaseDocxSizeChange(width, height);
      }
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const wrapper = host.querySelector<HTMLElement>('.docx-wrapper');
    if (!wrapper) {
      return;
    }

    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
    };
  }, [args.containerRef, args.document]);

  useEffect(() => {
    if (
      !args.document ||
      !args.windowRef.current ||
      !args.zoomContentRef.current ||
      args.baseDocxSize.width <= 0 ||
      args.baseDocxSize.height <= 0
    ) {
      return;
    }

    const viewport = args.windowRef.current;
    const zoomContent = args.zoomContentRef.current;

    const measureLayout = () => {
      const visualWidth = Math.ceil(zoomContent.getBoundingClientRect().width);
      const visualHeight = Math.ceil(zoomContent.getBoundingClientRect().height);
      if (visualWidth <= 0 || visualHeight <= 0) {
        return;
      }

      const centeredGutter = Math.max(0, Math.floor((viewport.clientWidth - visualWidth) / 2));
      const gutter = Math.max(args.minStageGutter, centeredGutter);
      const width = visualWidth + gutter * 2;
      const height = visualHeight;

      args.onStageLayoutChange(width, height, gutter);
    };

    measureLayout();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      measureLayout();
    });
    observer.observe(viewport);
    observer.observe(zoomContent);
    return () => {
      observer.disconnect();
    };
  }, [
    args.baseDocxSize.height,
    args.baseDocxSize.width,
    args.document,
    args.minStageGutter,
    args.windowRef,
    args.zoomContentRef,
    args.zoomLevel
  ]);

  useEffect(() => {
    if (!args.document || !args.windowRef.current || args.stageLayout.width <= 0 || args.stageLayout.height <= 0) {
      return;
    }

    const viewport = args.windowRef.current;
    const previous = args.previousStageSizeRef.current;

    if (previous && previous.width > 0 && previous.height > 0) {
      const centerRatioX = (viewport.scrollLeft + viewport.clientWidth / 2) / previous.width;
      const centerRatioY = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(previous.height, 1);

      const maxScrollLeft = Math.max(0, args.stageLayout.width - viewport.clientWidth);
      const maxScrollTop = Math.max(0, args.stageLayout.height - viewport.clientHeight);

      viewport.scrollLeft = Math.min(maxScrollLeft, Math.max(0, centerRatioX * args.stageLayout.width - viewport.clientWidth / 2));
      viewport.scrollTop = Math.min(maxScrollTop, Math.max(0, centerRatioY * args.stageLayout.height - viewport.clientHeight / 2));
    } else {
      viewport.scrollLeft = Math.max(0, (args.stageLayout.width - viewport.clientWidth) / 2);
      viewport.scrollTop = 0;
    }

    args.previousStageSizeRef.current = { width: args.stageLayout.width, height: args.stageLayout.height };
  }, [args.document, args.stageLayout.height, args.stageLayout.width, args.windowRef]);
}
