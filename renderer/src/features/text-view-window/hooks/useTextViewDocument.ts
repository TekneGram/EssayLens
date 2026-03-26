import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { usePorts } from '@/app/ports';
import { renderDocxIntoContainer } from '../adapters/docxRenderer';
import { buildRenderBridge, type RenderBridge } from '../adapters/renderBridge';
import { loadTextViewDocument, type LoadedTextViewDocument, type TextViewStatusKind } from '../application/textViewDocument.workflows';
export type { LoadedTextViewDocument, TextViewStatusKind } from '../application/textViewDocument.workflows';

interface UseTextViewDocumentArgs {
  selectedFileId: string | null;
  containerRef: RefObject<HTMLDivElement>;
  onSelectionCleared: () => void;
  onDocumentTextChange?: (text: string | null) => void;
}

interface UseTextViewDocumentResult {
  document: LoadedTextViewDocument | null;
  bridgeRef: MutableRefObject<RenderBridge | null>;
  statusMessage: string;
  statusKind: TextViewStatusKind;
  isLoading: boolean;
}

export function useTextViewDocument({
  selectedFileId,
  containerRef,
  onSelectionCleared,
  onDocumentTextChange
}: UseTextViewDocumentArgs): UseTextViewDocumentResult {
  const { assessment } = usePorts();
  const [document, setDocument] = useState<LoadedTextViewDocument | null>(null);
  const [statusMessage, setStatusMessage] = useState('Select a .docx file to begin.');
  const [statusKind, setStatusKind] = useState<TextViewStatusKind>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const bridgeRef = useRef<RenderBridge | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    onSelectionCleared();
    // Selection should reset only when file changes.
  }, [selectedFileId]);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (!selectedFileId) {
      setDocument(null);
      bridgeRef.current = null;
      setStatusMessage('Select a .docx file to begin.');
      setStatusKind('idle');
      setIsLoading(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setStatusMessage('Loading document...');
      setStatusKind('loading');

      try {
        const result = await loadTextViewDocument(selectedFileId, assessment);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setDocument(result.document);
        setStatusKind(result.statusKind);
        setStatusMessage(result.statusMessage);
        if (!result.document && containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      } catch {
        if (requestId !== requestIdRef.current) {
          return;
        }
        setDocument(null);
        bridgeRef.current = null;
        setStatusMessage('Unable to load document.');
        setStatusKind('error');
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    void load();
  }, [assessment, containerRef, selectedFileId]);

  useEffect(() => {
    if (!onDocumentTextChange) {
      return;
    }
    if (!document) {
      onDocumentTextChange(null);
      return;
    }
    const fullText = document.textMap.paragraphs.map((paragraph) => paragraph.text).join('\n');
    onDocumentTextChange(fullText);
  }, [document, onDocumentTextChange]);

  useEffect(() => {
    if (!document || !containerRef.current) {
      bridgeRef.current = null;
      return;
    }

    const render = async () => {
      if (!containerRef.current) {
        return;
      }
      await renderDocxIntoContainer(document.buffer, containerRef.current);

      if (!containerRef.current) {
        return;
      }

      bridgeRef.current = buildRenderBridge(containerRef.current, document.textMap);
    };

    void render();
  }, [containerRef, document]);

  return {
    document,
    bridgeRef,
    statusMessage,
    statusKind,
    isLoading
  };
}
