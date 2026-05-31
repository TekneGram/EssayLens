import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { generateFeedbackFile } from './feedbackFileGenerator';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function createMinimalDocx(filePath: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    <w:p><w:r><w:t>Student writing.</w:t></w:r></w:p>
    <w:sectPr/>
  </w:body>
</w:document>`
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buffer);
}

function directChildrenByLocalName(parent: Element, localName: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).localName === localName) {
      out.push(node as Element);
    }
  }
  return out;
}

function directChildLocalNames(parent: Element): string[] {
  const out: string[] = [];
  for (let i = 0; i < parent.childNodes.length; i += 1) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1) {
      out.push((node as Element).localName);
    }
  }
  return out;
}

function paragraphText(paragraph: Element): string {
  const textNodes = paragraph.getElementsByTagNameNS(W_NS, 't');
  let text = '';
  for (let i = 0; i < textNodes.length; i += 1) {
    text += textNodes[i].textContent ?? '';
  }
  return text;
}

describe('generateFeedbackFile', () => {
  it('appends block feedback two blank paragraphs below the document body before section properties', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-feedback-'));
    const sourcePath = path.join(tempDir, 'source.docx');
    const outputPath = path.join(tempDir, 'source.annotated.docx');
    await createMinimalDocx(sourcePath);

    await generateFeedbackFile({
      sourceFilePath: sourcePath,
      outputPath,
      comments: [],
      blockComments: [{ commentText: 'Applied block feedback\nSecond line' }]
    });

    const outputBuffer = await fs.readFile(outputPath);
    const outputZip = await JSZip.loadAsync(outputBuffer);
    const documentXml = await outputZip.file('word/document.xml')!.async('string');
    const documentDoc = new DOMParser().parseFromString(documentXml, 'application/xml');
    const body = documentDoc.getElementsByTagNameNS(W_NS, 'body')[0];

    expect(directChildLocalNames(body)).toEqual(['p', 'p', 'p', 'p', 'sectPr']);

    const paragraphs = directChildrenByLocalName(body, 'p');
    expect(paragraphText(paragraphs[0])).toBe('Student writing.');
    expect(paragraphText(paragraphs[1])).toBe('');
    expect(paragraphText(paragraphs[2])).toBe('');
    expect(paragraphText(paragraphs[3])).toBe('Applied block feedbackSecond line');
    expect(paragraphs[3].getElementsByTagNameNS(W_NS, 'br')).toHaveLength(1);
  });
});
