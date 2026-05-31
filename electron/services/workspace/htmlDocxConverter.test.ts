import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DOMParser } from '@xmldom/xmldom';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { convertHtmlFilesToDocx, extractParagraphsFromHtml } from './htmlDocxConverter';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

async function readDocxParagraphs(filePath: string): Promise<string[]> {
  const buffer = await fs.readFile(filePath);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')!.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const paragraphNodes = doc.getElementsByTagNameNS(W_NS, 'p');
  const paragraphs: string[] = [];
  for (let i = 0; i < paragraphNodes.length; i += 1) {
    const textNodes = paragraphNodes[i].getElementsByTagNameNS(W_NS, 't');
    let text = '';
    for (let j = 0; j < textNodes.length; j += 1) {
      text += textNodes[j].textContent ?? '';
    }
    paragraphs.push(text);
  }
  return paragraphs;
}

describe('htmlDocxConverter', () => {
  it('extracts non-empty paragraph text and splits br tags into paragraphs', () => {
    const paragraphs = extractParagraphsFromHtml(`
      <html><body>
        <p>First &amp; second</p>
        <p>Third<br>Fourth<br />Fifth</p>
        <p>   </p>
        <div>Ignored text</div>
      </body></html>
    `);

    expect(paragraphs).toEqual(['First & second', 'Third', 'Fourth', 'Fifth']);
  });

  it('converts html paragraphs into a sibling docx', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-html-docx-'));
    const htmlPath = path.join(tempDir, 'essay.html');
    const outputPath = path.join(tempDir, 'essay.docx');
    await fs.writeFile(htmlPath, '<p>First paragraph.</p><p>Second<br>Third</p>', 'utf8');

    const generated = await convertHtmlFilesToDocx([
      { path: htmlPath, name: 'essay.html', extension: 'html' }
    ]);

    expect(generated).toEqual([{ path: outputPath, name: 'essay.docx', extension: 'docx' }]);
    await expect(fs.stat(outputPath)).resolves.toBeTruthy();
    await expect(readDocxParagraphs(outputPath)).resolves.toEqual([
      'First paragraph.',
      'Second',
      'Third'
    ]);
  });

  it('skips html without paragraph text', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-html-docx-'));
    const htmlPath = path.join(tempDir, 'empty.html');
    await fs.writeFile(htmlPath, '<html><body><p> </p><div>Ignored</div></body></html>', 'utf8');

    const generated = await convertHtmlFilesToDocx([
      { path: htmlPath, name: 'empty.html', extension: 'html' }
    ]);

    expect(generated).toEqual([]);
    await expect(fs.stat(path.join(tempDir, 'empty.docx'))).rejects.toBeTruthy();
  });

  it('does not overwrite an existing docx with the same basename', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-html-docx-'));
    const htmlPath = path.join(tempDir, 'essay.html');
    const outputPath = path.join(tempDir, 'essay.docx');
    await fs.writeFile(htmlPath, '<p>Converted text.</p>', 'utf8');
    await fs.writeFile(outputPath, 'existing docx bytes', 'utf8');

    const generated = await convertHtmlFilesToDocx([
      { path: htmlPath, name: 'essay.html', extension: 'html' }
    ]);

    expect(generated).toEqual([]);
    await expect(fs.readFile(outputPath, 'utf8')).resolves.toBe('existing docx bytes');
  });
});
