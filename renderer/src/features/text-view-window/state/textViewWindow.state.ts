export interface StageLayout {
  width: number;
  height: number;
  gutter: number;
}

export interface DocxSize {
  width: number;
  height: number;
}

export interface TextViewWindowState {
  zoomPercent: number;
  baseDocxSize: DocxSize;
  stageLayout: StageLayout;
}

export type TextViewWindowAction =
  | { type: 'textView/setZoomPercent'; payload: number }
  | { type: 'textView/setBaseDocxSize'; payload: DocxSize }
  | { type: 'textView/setStageLayout'; payload: StageLayout }
  | { type: 'textView/resetLayout'; payload: { gutter: number } };

export function createInitialTextViewWindowState(defaultZoomPercent: number, gutter: number): TextViewWindowState {
  return {
    zoomPercent: defaultZoomPercent,
    baseDocxSize: { width: 0, height: 0 },
    stageLayout: { width: 0, height: 0, gutter }
  };
}

export function textViewWindowReducer(state: TextViewWindowState, action: TextViewWindowAction): TextViewWindowState {
  switch (action.type) {
    case 'textView/setZoomPercent':
      if (state.zoomPercent === action.payload) {
        return state;
      }
      return {
        ...state,
        zoomPercent: action.payload
      };
    case 'textView/setBaseDocxSize':
      if (state.baseDocxSize.width === action.payload.width && state.baseDocxSize.height === action.payload.height) {
        return state;
      }
      return {
        ...state,
        baseDocxSize: action.payload
      };
    case 'textView/setStageLayout':
      if (
        state.stageLayout.width === action.payload.width &&
        state.stageLayout.height === action.payload.height &&
        state.stageLayout.gutter === action.payload.gutter
      ) {
        return state;
      }
      return {
        ...state,
        stageLayout: action.payload
      };
    case 'textView/resetLayout':
      return {
        ...state,
        baseDocxSize: { width: 0, height: 0 },
        stageLayout: { width: 0, height: 0, gutter: action.payload.gutter }
      };
    default:
      return state;
  }
}
