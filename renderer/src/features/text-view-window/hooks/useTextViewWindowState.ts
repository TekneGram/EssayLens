import { useMemo, useReducer } from 'react';
import { clampZoomPercent } from '../domain/textView.logic';
import { createInitialTextViewWindowState, textViewWindowReducer } from '../state/textViewWindow.state';

interface UseTextViewWindowStateArgs {
  minZoomPercent: number;
  maxZoomPercent: number;
  defaultZoomPercent: number;
  minStageGutter: number;
}

export function useTextViewWindowState(args: UseTextViewWindowStateArgs) {
  const [state, dispatch] = useReducer(
    textViewWindowReducer,
    createInitialTextViewWindowState(args.defaultZoomPercent, args.minStageGutter)
  );

  const zoomLevel = useMemo(() => state.zoomPercent / 100, [state.zoomPercent]);

  const setZoomPercent = (next: number) => {
    dispatch({
      type: 'textView/setZoomPercent',
      payload: clampZoomPercent(next, args.minZoomPercent, args.maxZoomPercent)
    });
  };

  const resetZoom = () => {
    setZoomPercent(args.defaultZoomPercent);
  };

  const resetLayout = () => {
    dispatch({ type: 'textView/resetLayout', payload: { gutter: args.minStageGutter } });
  };

  const setBaseDocxSize = (width: number, height: number) => {
    dispatch({ type: 'textView/setBaseDocxSize', payload: { width, height } });
  };

  const setStageLayout = (width: number, height: number, gutter: number) => {
    dispatch({ type: 'textView/setStageLayout', payload: { width, height, gutter } });
  };

  return {
    zoomLevel,
    zoomPercent: state.zoomPercent,
    baseDocxSize: state.baseDocxSize,
    stageLayout: state.stageLayout,
    setZoomPercent,
    resetZoom,
    resetLayout,
    setBaseDocxSize,
    setStageLayout
  };
}
