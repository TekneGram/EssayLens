import type { OriginalTextViewProps } from '@/features/assessment-tab/types';
import { TextViewWindow } from '@/features/text-view-window';

export function OriginalTextView({
  selectedFileId,
  text,
  pendingSelection,
  activeCommentSelection,
  activeCommentId,
  onSelectionCaptured,
  onDocumentTextChange
}: OriginalTextViewProps) {
  return (
    <section className="original-text-view subpane" data-testid="original-text-view">
      <TextViewWindow
        title="OriginalTextView"
        selectedFileId={selectedFileId}
        text={text}
        pendingSelection={pendingSelection}
        activeCommentSelection={activeCommentSelection}
        activeCommentId={activeCommentId}
        onSelectionCaptured={onSelectionCaptured}
        onDocumentTextChange={onDocumentTextChange}
      />
    </section>
  );
}
