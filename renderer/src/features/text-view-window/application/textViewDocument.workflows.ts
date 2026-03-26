import { buildTextMapFromDocx } from '../domain/docxTextMap';
import type { WordTextMap } from '../domain/textMapTypes';
import { extractAssessmentDocument } from '@/features/comments-view';
import type { AssessmentPort } from '@/app/ports';

export interface LoadedTextViewDocument {
  fileId: string;
  fileName: string;
  buffer: ArrayBuffer;
  textMap: WordTextMap;
}

export type TextViewStatusKind = 'idle' | 'loading' | 'loaded' | 'unsupported' | 'error';

export interface LoadTextViewDocumentResult {
  document: LoadedTextViewDocument | null;
  statusKind: TextViewStatusKind;
  statusMessage: string;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function loadTextViewDocument(
  fileId: string,
  assessmentPort: AssessmentPort
): Promise<LoadTextViewDocumentResult> {
  const response = await extractAssessmentDocument(assessmentPort, fileId);

  if (response.format !== 'docx' || !response.dataBase64) {
    return {
      document: null,
      statusKind: 'unsupported',
      statusMessage: 'This view currently supports .docx files only.'
    };
  }

  const buffer = base64ToArrayBuffer(response.dataBase64);
  const textMap = await buildTextMapFromDocx(buffer);
  const fileName = response.fileName ?? fileId.split(/[\\/]/).pop() ?? fileId;

  return {
    document: {
      fileId,
      fileName,
      buffer,
      textMap
    },
    statusKind: 'loaded',
    statusMessage: `Loaded ${fileName}. Select text to add comments.`
  };
}
