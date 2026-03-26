import fs from 'node:fs/promises';
import path from 'node:path';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';

export interface FeedbackAnchor {
  part: string;
  paragraphIndex: number;
  runIndex: number;
  charOffset: number;
}

export interface FeedbackFileComment {
  commentText: string;
  exactQuote: string;
  startAnchor: FeedbackAnchor;
  endAnchor: FeedbackAnchor;
}

export interface FeedbackFileRequest {
  sourceFilePath: string;
  outputPath: string;
  comments: FeedbackFileComment[];
}

export interface FeedbackFileResult {
  outputPath: string;
}

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

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

function elementText(el: Element): string {
  let text = '';
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const node = el.childNodes[i];
    if (node.nodeType === 3) {
      text += node.nodeValue ?? '';
    }
  }
  return text;
}

function setText(el: Element, value: string): void {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
  el.appendChild(el.ownerDocument.createTextNode(value));
  if (/^\s|\s$/.test(value)) {
    el.setAttribute('xml:space', 'preserve');
  }
}

function nthParagraph(body: Element, paragraphIndex: number): Element | null {
  const paragraphs = directChildrenByLocalName(body, 'p');
  return paragraphs[paragraphIndex] ?? null;
}

function nthRun(paragraph: Element, runIndex: number): Element | null {
  const runs = directChildrenByLocalName(paragraph, 'r');
  return runs[runIndex] ?? null;
}

function compareAnchorPosition(a: FeedbackAnchor, b: FeedbackAnchor): number {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return a.paragraphIndex - b.paragraphIndex;
  }
  if (a.runIndex !== b.runIndex) {
    return a.runIndex - b.runIndex;
  }
  return a.charOffset - b.charOffset;
}

function nextRun(run: Element): Element | null {
  let node: Node | null = run.nextSibling;
  while (node) {
    if (node.nodeType === 1 && (node as Element).localName === 'r') {
      return node as Element;
    }
    node = node.nextSibling;
  }
  return null;
}

function previousRun(run: Element): Element | null {
  let node: Node | null = run.previousSibling;
  while (node) {
    if (node.nodeType === 1 && (node as Element).localName === 'r') {
      return node as Element;
    }
    node = node.previousSibling;
  }
  return null;
}

function cloneRunWithText(run: Element, text: string): Element {
  const doc = run.ownerDocument;
  const newRun = doc.createElementNS(W_NS, 'w:r');
  const rPr = directChildrenByLocalName(run, 'rPr')[0];
  if (rPr) {
    newRun.appendChild(rPr.cloneNode(true));
  }

  const t = doc.createElementNS(W_NS, 'w:t');
  setText(t, text);
  newRun.appendChild(t);
  return newRun;
}

function runText(run: Element): string {
  const textNodes = directChildrenByLocalName(run, 't');
  return textNodes.map((node) => elementText(node)).join('');
}

function splitRunAtAnchor(paragraph: Element, anchor: FeedbackAnchor, isStart: boolean): Element | null {
  const run = nthRun(paragraph, anchor.runIndex);
  if (!run) {
    return null;
  }

  const full = runText(run);
  const offset = Math.max(0, Math.min(anchor.charOffset, full.length));

  if (offset === 0) {
    return isStart ? run : previousRun(run) ?? run;
  }

  if (offset === full.length) {
    return isStart ? nextRun(run) ?? run : run;
  }

  const leftText = full.slice(0, offset);
  const rightText = full.slice(offset);

  const leftRun = cloneRunWithText(run, leftText);
  const rightRun = cloneRunWithText(run, rightText);

  paragraph.insertBefore(leftRun, run);
  paragraph.insertBefore(rightRun, run);
  paragraph.removeChild(run);

  return isStart ? rightRun : leftRun;
}

function splitSameRunRange(paragraph: Element, start: FeedbackAnchor, end: FeedbackAnchor): {
  startRun: Element;
  endRun: Element;
} | null {
  const run = nthRun(paragraph, start.runIndex);
  if (!run) {
    return null;
  }

  const full = runText(run);
  const leftCut = Math.max(0, Math.min(start.charOffset, full.length));
  const rightCut = Math.max(leftCut, Math.min(end.charOffset, full.length));

  if (leftCut === rightCut) {
    return { startRun: run, endRun: run };
  }

  const leftText = full.slice(0, leftCut);
  const middleText = full.slice(leftCut, rightCut);
  const rightText = full.slice(rightCut);
  const middleRun = cloneRunWithText(run, middleText);

  if (leftText.length > 0) {
    paragraph.insertBefore(cloneRunWithText(run, leftText), run);
  }
  paragraph.insertBefore(middleRun, run);
  if (rightText.length > 0) {
    paragraph.insertBefore(cloneRunWithText(run, rightText), run);
  }

  paragraph.removeChild(run);
  return { startRun: middleRun, endRun: middleRun };
}

function createCommentMarker(doc: Document, localName: string, id: number): Element {
  const el = doc.createElementNS(W_NS, `w:${localName}`);
  el.setAttribute('w:id', String(id));
  return el;
}

function appendCommentReferenceRun(doc: Document, paragraph: Element, id: number, afterNode: Node): void {
  const run = doc.createElementNS(W_NS, 'w:r');
  const rPr = doc.createElementNS(W_NS, 'w:rPr');
  const rStyle = doc.createElementNS(W_NS, 'w:rStyle');
  rStyle.setAttribute('w:val', 'CommentReference');
  rPr.appendChild(rStyle);
  run.appendChild(rPr);

  const reference = doc.createElementNS(W_NS, 'w:commentReference');
  reference.setAttribute('w:id', String(id));
  run.appendChild(reference);

  paragraph.insertBefore(run, afterNode.nextSibling);
}

function ensureCommentsPart(commentsXml: string | null): Document {
  if (commentsXml) {
    return new DOMParser().parseFromString(commentsXml, 'application/xml');
  }

  return new DOMParser().parseFromString(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:comments xmlns:w="${W_NS}"/>`,
    'application/xml'
  );
}

function appendCommentToCommentsXml(commentsDoc: Document, id: number, text: string): void {
  const root = commentsDoc.documentElement;
  const comment = commentsDoc.createElementNS(W_NS, 'w:comment');
  comment.setAttribute('w:id', String(id));
  comment.setAttribute('w:author', 'Teacher');
  comment.setAttribute('w:initials', 'T');
  comment.setAttribute('w:date', new Date().toISOString());

  const p = commentsDoc.createElementNS(W_NS, 'w:p');
  const r = commentsDoc.createElementNS(W_NS, 'w:r');
  const t = commentsDoc.createElementNS(W_NS, 'w:t');
  setText(t, text);

  r.appendChild(t);
  p.appendChild(r);
  comment.appendChild(p);
  root.appendChild(comment);
}

function ensureCommentsRelationshipAndType(zip: JSZip): Promise<void[]> {
  return Promise.all([ensureRelationship(zip), ensureContentType(zip)]);
}

async function ensureRelationship(zip: JSZip): Promise<void> {
  const relPath = 'word/_rels/document.xml.rels';
  const relEntry = zip.file(relPath);
  if (!relEntry) {
    return;
  }

  const xml = await relEntry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;

  const relationships = root.getElementsByTagNameNS(REL_NS, 'Relationship');
  for (let i = 0; i < relationships.length; i += 1) {
    const rel = relationships[i];
    if (rel.getAttribute('Type') === `${OFFICE_REL_NS}/comments`) {
      return;
    }
  }

  let maxId = 0;
  for (let i = 0; i < relationships.length; i += 1) {
    const rel = relationships[i];
    const id = rel.getAttribute('Id') ?? '';
    const num = Number(id.replace('rId', ''));
    if (!Number.isNaN(num) && num > maxId) {
      maxId = num;
    }
  }

  const relationship = doc.createElementNS(REL_NS, 'Relationship');
  relationship.setAttribute('Id', `rId${maxId + 1}`);
  relationship.setAttribute('Type', `${OFFICE_REL_NS}/comments`);
  relationship.setAttribute('Target', 'comments.xml');
  root.appendChild(relationship);

  zip.file(relPath, new XMLSerializer().serializeToString(doc));
}

async function ensureContentType(zip: JSZip): Promise<void> {
  const contentTypePath = '[Content_Types].xml';
  const entry = zip.file(contentTypePath);
  if (!entry) {
    return;
  }

  const xml = await entry.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const root = doc.documentElement;

  const overrides = root.getElementsByTagName('Override');
  for (let i = 0; i < overrides.length; i += 1) {
    const override = overrides[i];
    if (override.getAttribute('PartName') === '/word/comments.xml') {
      return;
    }
  }

  const override = doc.createElement('Override');
  override.setAttribute('PartName', '/word/comments.xml');
  override.setAttribute(
    'ContentType',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml'
  );
  root.appendChild(override);

  zip.file(contentTypePath, new XMLSerializer().serializeToString(doc));
}

function compareAnchorsDescending(a: FeedbackFileComment, b: FeedbackFileComment): number {
  return compareAnchorPosition(b.startAnchor, a.startAnchor);
}

function findMaxCommentId(commentsDoc: Document): number {
  const comments = commentsDoc.getElementsByTagNameNS(W_NS, 'comment');
  let max = 0;
  for (let i = 0; i < comments.length; i += 1) {
    const value = Number(comments[i].getAttribute('w:id') ?? comments[i].getAttribute('id'));
    if (!Number.isNaN(value) && value > max) {
      max = value;
    }
  }
  return max;
}

function appendSummaryParagraph(doc: Document, body: Element, text: string): void {
  const p = doc.createElementNS(W_NS, 'w:p');
  const r = doc.createElementNS(W_NS, 'w:r');
  const t = doc.createElementNS(W_NS, 'w:t');
  setText(t, text);
  r.appendChild(t);
  p.appendChild(r);
  body.appendChild(p);
}

async function generateAnnotatedDocx(sourceBuffer: Buffer, comments: FeedbackFileComment[]): Promise<Buffer> {
  const zip = await JSZip.loadAsync(sourceBuffer);
  const documentEntry = zip.file('word/document.xml');
  if (!documentEntry) {
    throw new Error('word/document.xml was not found');
  }

  const documentXml = await documentEntry.async('string');
  const documentDoc = new DOMParser().parseFromString(documentXml, 'application/xml');
  const body = documentDoc.getElementsByTagNameNS(W_NS, 'body')[0];
  if (!body) {
    throw new Error('Invalid word/document.xml: missing body element');
  }

  const commentsEntry = zip.file('word/comments.xml');
  const commentsXml = commentsEntry ? await commentsEntry.async('string') : null;
  const commentsDoc = ensureCommentsPart(commentsXml);
  let commentId = findMaxCommentId(commentsDoc);

  const ordered = [...comments].sort(compareAnchorsDescending);

  for (const comment of ordered) {
    let startAnchor = comment.startAnchor;
    let endAnchor = comment.endAnchor;

    if (compareAnchorPosition(startAnchor, endAnchor) > 0) {
      startAnchor = comment.endAnchor;
      endAnchor = comment.startAnchor;
    }

    let startRun: Element | null;
    let endRun: Element | null;
    let startParagraph: Element | null = null;
    let endParagraph: Element | null = null;

    if (startAnchor.paragraphIndex === endAnchor.paragraphIndex) {
      const paragraph = nthParagraph(body, startAnchor.paragraphIndex);
      if (!paragraph) {
        continue;
      }

      if (startAnchor.runIndex === endAnchor.runIndex) {
        const split = splitSameRunRange(paragraph, startAnchor, endAnchor);
        startRun = split?.startRun ?? null;
        endRun = split?.endRun ?? null;
      } else {
        startRun = splitRunAtAnchor(paragraph, startAnchor, true);
        endRun = splitRunAtAnchor(paragraph, endAnchor, false);
      }

      startParagraph = paragraph;
      endParagraph = paragraph;
    } else {
      startParagraph = nthParagraph(body, startAnchor.paragraphIndex);
      endParagraph = nthParagraph(body, endAnchor.paragraphIndex);
      if (!startParagraph || !endParagraph) {
        continue;
      }

      startRun = splitRunAtAnchor(startParagraph, startAnchor, true);
      endRun = splitRunAtAnchor(endParagraph, endAnchor, false);
    }

    if (!startRun || !endRun || !startParagraph || !endParagraph) {
      continue;
    }

    commentId += 1;

    const startMarker = createCommentMarker(documentDoc, 'commentRangeStart', commentId);
    const endMarker = createCommentMarker(documentDoc, 'commentRangeEnd', commentId);

    startParagraph.insertBefore(startMarker, startRun);

    if (endRun.nextSibling) {
      endParagraph.insertBefore(endMarker, endRun.nextSibling);
      appendCommentReferenceRun(documentDoc, endParagraph, commentId, endMarker);
    } else {
      endParagraph.appendChild(endMarker);
      appendCommentReferenceRun(documentDoc, endParagraph, commentId, endMarker);
    }

    appendCommentToCommentsXml(commentsDoc, commentId, comment.commentText);
  }

  if (comments.length > 0) {
    appendSummaryParagraph(documentDoc, body, 'Feedback Summary');
    comments.forEach((comment) => {
      appendSummaryParagraph(documentDoc, body, `- [${comment.exactQuote}] ${comment.commentText}`);
    });
  }

  zip.file('word/document.xml', new XMLSerializer().serializeToString(documentDoc));
  zip.file('word/comments.xml', new XMLSerializer().serializeToString(commentsDoc));

  await ensureCommentsRelationshipAndType(zip);
  return zip.generateAsync({ type: 'nodebuffer' });
}

export async function generateFeedbackFile(request: FeedbackFileRequest): Promise<FeedbackFileResult> {
  if (path.extname(request.sourceFilePath).toLowerCase() !== '.docx') {
    throw new Error('Feedback document generation currently supports only .docx source files.');
  }

  const sourceBuffer = await fs.readFile(request.sourceFilePath);
  const outputBuffer = await generateAnnotatedDocx(sourceBuffer, request.comments);
  await fs.writeFile(request.outputPath, outputBuffer);

  return {
    outputPath: request.outputPath
  };
}
