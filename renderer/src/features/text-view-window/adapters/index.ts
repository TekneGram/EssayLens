export { renderDocxIntoContainer } from './docxRenderer';
export { buildRangeFromAnchors, buildRenderBridge, selectionToAnchors } from './renderBridge';
export type { RenderBridge } from './renderBridge';
export {
  addRangeToWindowSelection,
  clearWindowSelection,
  findParagraph,
  getActiveWindowSelection,
  getParagraphCharOffset
} from './windowSelection';
