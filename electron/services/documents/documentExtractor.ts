import fs from 'node:fs/promises';
import path from 'node:path';

export interface ExtractedDocument {
  text: string;
  extractedAt: string;
  format: 'docx' | 'pdf' | 'other';
  dataBase64?: string;
}

export async function extractDocumentText(filePath: string): Promise<ExtractedDocument> {
  const extension = path.extname(filePath).toLowerCase();
  const extractedAt = new Date().toISOString();

  if (extension === '.docx') {
    const fileBuffer = await fs.readFile(filePath);
    return {
      text: '',
      extractedAt,
      format: 'docx',
      dataBase64: fileBuffer.toString('base64')
    };
  }

  if (extension === '.pdf') {
    const fileBuffer = await fs.readFile(filePath);
    return {
      text: '',
      extractedAt,
      format: 'pdf',
      dataBase64: fileBuffer.toString('base64')
    };
  }

  return {
    text: '',
    extractedAt,
    format: 'other'
  };
}
