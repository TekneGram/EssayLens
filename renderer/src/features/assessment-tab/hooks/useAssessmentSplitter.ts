import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';

interface UseAssessmentSplitterParams {
  assessmentSplitRatio: number;
  setSplitRatio: (ratio: number) => void;
}

interface UseAssessmentSplitterResult {
  containerRef: RefObject<HTMLDivElement>;
  onSplitterPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onSplitterKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export function useAssessmentSplitter({
  assessmentSplitRatio,
  setSplitRatio
}: UseAssessmentSplitterParams): UseAssessmentSplitterResult {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const updateRatioFromClientX = (clientX: number) => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const bounds = container.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }
    const ratio = (clientX - bounds.left) / bounds.width;
    setSplitRatio(ratio);
  };

  const onSplitterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();

    const onPointerMove = (moveEvent: PointerEvent) => {
      updateRatioFromClientX(moveEvent.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onSplitterKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setSplitRatio(assessmentSplitRatio - 0.02);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setSplitRatio(assessmentSplitRatio + 0.02);
    }
  };

  return {
    containerRef,
    onSplitterPointerDown,
    onSplitterKeyDown
  };
}
