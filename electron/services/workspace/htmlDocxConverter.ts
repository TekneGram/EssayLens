import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import type { ScannedFile } from './fileScanner';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeHtmlEntity(entity: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const codePoint = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : `&${entity};`;
  }
  if (entity.startsWith('#')) {
    const codePoint = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : `&${entity};`;
  }
  return named[entity] ?? `&${entity};`;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&([a-zA-Z]+|#[0-9]+|#x[0-9a-fA-F]+);/g, (_match, entity: string) => decodeHtmlEntity(entity));
}

export function extractParagraphsFromHtml(html: string): string[] {
  const paragraphs: string[] = [];
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match: RegExpExecArray | null;

  while ((match = paragraphPattern.exec(html)) !== null) {
    const withBreaks = match[1].replace(/<br\s*\/?>/gi, '\n');
    const withoutTags = withBreaks.replace(/<[^>]+>/g, '');
    const decoded = decodeHtmlEntities(withoutTags);
    const parts = decoded
      .split(/\r\n|\r|\n/)
      .map((part) => part.replace(/\s+/g, ' ').trim())
      .filter((part) => part.length > 0);
    paragraphs.push(...parts);
  }

  return paragraphs;
}

function createDocumentXml(paragraphs: string[]): string {
  const paragraphXml = paragraphs
    .map((paragraph) => `<w:p><w:r><w:t>${escapeXml(paragraph)}</w:t></w:r></w:p>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}"><w:body>${paragraphXml}<w:sectPr/></w:body></w:document>`;
}

async function writeDocxFromParagraphs(outputPath: string, paragraphs: string[]): Promise<void> {
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
  zip.file('word/document.xml', createDocumentXml(paragraphs));

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(outputPath, buffer);
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function htmlOutputPath(filePath: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}.docx`);
}

export async function convertHtmlFilesToDocx(scannedFiles: ScannedFile[]): Promise<ScannedFile[]> {
  const generatedFiles: ScannedFile[] = [];
  for (const file of scannedFiles) {
    if (file.extension.toLowerCase() !== 'html') {
      continue;
    }

    const outputPath = htmlOutputPath(file.path);
    if (await fileExists(outputPath)) {
      continue;
    }

    try {
      const html = await fs.readFile(file.path, 'utf8');
      const paragraphs = extractParagraphsFromHtml(html);
      if (paragraphs.length === 0) {
        continue;
      }

      await writeDocxFromParagraphs(outputPath, paragraphs);
      generatedFiles.push({
        path: outputPath,
        name: path.basename(outputPath),
        extension: 'docx'
      });
    } catch {
      continue;
    }
  }

  return generatedFiles;
}
