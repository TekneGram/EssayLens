import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const WORD_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function childElementsByLocalName(parent: Element, localName: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).localName === localName) {
      out.push(node as Element);
    }
  }
  return out;
}

function directText(el: Element): string {
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
  return childElementsByLocalName(run, 't').map((textNode) => directText(textNode)).join('');
}

export async function extractDocxTextFromBuffer(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) {
    throw new Error('word/document.xml was not found');
  }

  const xml = await documentEntry.async('string');
  const documentDoc = new DOMParser().parseFromString(xml, 'application/xml');
  const body = documentDoc.getElementsByTagNameNS(WORD_NAMESPACE, 'body')[0];
  if (!body) {
    throw new Error('Invalid word/document.xml: missing body element');
  }

  const paragraphTexts: string[] = [];
  const paragraphs = childElementsByLocalName(body, 'p');
  for (const paragraph of paragraphs) {
    const runs = childElementsByLocalName(paragraph, 'r');
    let paragraphText = '';
    for (const run of runs) {
      paragraphText += runText(run);
    }
    paragraphTexts.push(paragraphText);
  }

  return paragraphTexts.join('\n');
}
