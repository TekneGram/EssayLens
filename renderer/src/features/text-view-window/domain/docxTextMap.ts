import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import type { WordParagraphUnit, WordTextMap, WordTextUnit } from './textMapTypes';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function elementChildrenByLocalName(parent: Element, localName: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).localName === localName) {
      out.push(node as Element);
    }
  }
  return out;
}

function textFromElement(el: Element): string {
  let out = '';
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes[i];
    if (node.nodeType === 3) {
      out += node.nodeValue ?? '';
    }
  }
  return out;
}

function runText(run: Element): string {
  return elementChildrenByLocalName(run, 't').map((textNode) => textFromElement(textNode)).join('');
}

export async function buildTextMapFromDocx(buffer: ArrayBuffer): Promise<WordTextMap> {
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file('word/document.xml');
  if (!entry) {
    throw new Error('word/document.xml not found in DOCX package');
  }

  const xml = await entry.async('string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const bodyNodes = doc.getElementsByTagNameNS(WORD_NAMESPACE, 'body');
  const body = bodyNodes[0];

  if (!body) {
    throw new Error('Invalid DOCX: body element missing');
  }

  const paragraphsOut: WordParagraphUnit[] = [];
  let globalOffset = 0;

  const paragraphs = elementChildrenByLocalName(body, 'p');
  paragraphs.forEach((paragraph, paragraphIndex) => {
    const paragraphUnits: WordTextUnit[] = [];
    let paragraphText = '';

    const runs = elementChildrenByLocalName(paragraph, 'r');
    runs.forEach((run, runIndex) => {
      const text = runText(run);
      if (!text) {
        return;
      }

      const unit: WordTextUnit = {
        part: 'word/document.xml',
        paragraphIndex,
        runIndex,
        text,
        globalStart: globalOffset,
        globalEnd: globalOffset + text.length
      };

      paragraphUnits.push(unit);
      paragraphText += text;
      globalOffset += text.length;
    });

    paragraphsOut.push({
      part: 'word/document.xml',
      paragraphIndex,
      text: paragraphText,
      units: paragraphUnits,
      totalLength: paragraphText.length
    });

    globalOffset += 1;
  });

  return {
    paragraphs: paragraphsOut,
    part: 'word/document.xml'
  };
}
