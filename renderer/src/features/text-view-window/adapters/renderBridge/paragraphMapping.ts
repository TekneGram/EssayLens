import type { WordParagraphUnit, WordTextMap } from '../../domain/textMapTypes';
import type { RenderBridge } from './types';

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function collectParagraphCandidates(container: HTMLElement): HTMLElement[] {
  let candidates = Array.from(
    container.querySelectorAll<HTMLElement>('p, li, td, th, h1, h2, h3, h4, h5, h6')
  );

  if (candidates.length === 0) {
    candidates = Array.from(container.querySelectorAll<HTMLElement>('div'));
  }

  return candidates.filter((el) => normalizeText(el.textContent ?? '').length > 0);
}

function scoreMatch(a: string, b: string): number {
  if (a === b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length);
  }

  const minLen = Math.min(a.length, b.length);
  let prefix = 0;
  while (prefix < minLen && a[prefix] === b[prefix]) {
    prefix += 1;
  }

  return prefix / Math.max(a.length, b.length);
}

function mapParagraphElements(
  domParagraphs: HTMLElement[],
  ooxmlParagraphs: WordParagraphUnit[]
): { paragraphToIndex: WeakMap<HTMLElement, number>; indexToParagraph: Map<number, HTMLElement> } {
  const paragraphToIndex = new WeakMap<HTMLElement, number>();
  const indexToParagraph = new Map<number, HTMLElement>();

  let cursor = 0;
  const maxLookahead = 120;

  for (const domParagraph of domParagraphs) {
    const domText = normalizeText(domParagraph.textContent ?? '');
    if (!domText) {
      continue;
    }

    let bestIdx = -1;
    let bestScore = 0;
    const end = Math.min(ooxmlParagraphs.length, cursor + maxLookahead);

    for (let i = cursor; i < end; i += 1) {
      const para = ooxmlParagraphs[i];
      const paraText = normalizeText(para.text);
      const score = scoreMatch(domText, paraText);

      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }

      if (score === 1) {
        break;
      }
    }

    if (bestIdx >= 0 && bestScore >= 0.45) {
      const mappedIndex = ooxmlParagraphs[bestIdx].paragraphIndex;
      paragraphToIndex.set(domParagraph, mappedIndex);
      if (!indexToParagraph.has(mappedIndex)) {
        indexToParagraph.set(mappedIndex, domParagraph);
      }
      cursor = bestIdx + 1;
    }
  }

  return { paragraphToIndex, indexToParagraph };
}

export function buildRenderBridge(container: HTMLElement, textMap: WordTextMap): RenderBridge {
  const domParagraphs = collectParagraphCandidates(container);
  const mapped = mapParagraphElements(domParagraphs, textMap.paragraphs);

  return {
    paragraphToIndex: mapped.paragraphToIndex,
    indexToParagraph: mapped.indexToParagraph
  };
}

export function findMappedParagraphElement(node: Node, bridge: RenderBridge): HTMLElement | null {
  let current: Node | null = node.nodeType === 1 ? node : node.parentNode;
  while (current) {
    if (current.nodeType === 1) {
      const el = current as HTMLElement;
      if (bridge.paragraphToIndex.has(el)) {
        return el;
      }
    }
    current = current.parentNode;
  }
  return null;
}
