export type NodePosition = {
  node: Text;
  offset: number;
};

export type RenderBridge = {
  paragraphToIndex: WeakMap<HTMLElement, number>;
  indexToParagraph: Map<number, HTMLElement>;
};
