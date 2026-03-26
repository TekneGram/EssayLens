import type { CSSProperties } from 'react';
import { useAssessmentSplitter } from './hooks/useAssessmentSplitter';
import { useAssessmentTabController } from './hooks/useAssessmentTabController';
import type { AssessmentTabChatBindings } from './types';
import { CommentsView } from '@/features/comments-view';
import { OriginalTextView } from '@/features/original-text-view';
import type { SelectedFileType } from '@/app/types';

const ImageView = () => <div>Image View (Not Migrated)</div>;

interface AssessmentTabProps {
  selectedFileType: SelectedFileType;
  onChatBindingsChange?: (bindings: AssessmentTabChatBindings) => void;
}

export function AssessmentTab({ selectedFileType, onChatBindingsChange }: AssessmentTabProps) {
  const {
    selectedFileId,
    originalText,
    comments,
    pendingSelection,
    activeCommentId,
    chatMode,
    isModeLockedToChat,
    activeCommentsTab,
    assessmentSplitRatio,
    isCommentsLoading,
    isGenerateFeedbackPending,
    canGenerateFeedbackDocument,
    commentsError,
    onSelectionCaptured,
    onSelectComment,
    onEditComment,
    onDeleteComment,
    onApplyComment,
    onSendToLlm,
    onGenerateFeedbackDocument,
    onCommentsTabChange,
    onDocumentTextChange,
    setSplitRatio
  } = useAssessmentTabController({ selectedFileType, onChatBindingsChange });

  const { containerRef, onSplitterPointerDown, onSplitterKeyDown } = useAssessmentSplitter({
    assessmentSplitRatio,
    setSplitRatio
  });

  const isImageViewOpen = selectedFileType === 'image';
  const mode = isImageViewOpen ? 'three-pane' : 'two-pane';

  return (
    <div
      ref={containerRef}
      className="assessment-tab workspace assessment"
      data-testid="assessment-tab"
      data-mode={mode}
      style={
        {
          '--assessment-left-ratio': String(assessmentSplitRatio)
        } as CSSProperties
      }
    >
      <div data-testid="assessment-orchestrator-state" hidden>
        {`mode:${chatMode};locked:${String(isModeLockedToChat)}`}
      </div>
      {isImageViewOpen ? <ImageView /> : null}
      <OriginalTextView
        selectedFileId={selectedFileId}
        text={originalText}
        pendingSelection={pendingSelection}
        activeCommentId={activeCommentId}
        onSelectionCaptured={onSelectionCaptured}
        onDocumentTextChange={onDocumentTextChange}
      />
      {!isImageViewOpen ? (
        <div
          className="assessment-splitter"
          data-testid="assessment-splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize assessment panes"
          tabIndex={0}
          onPointerDown={onSplitterPointerDown}
          onKeyDown={onSplitterKeyDown}
        />
      ) : null}
      <CommentsView
        comments={comments}
        activeCommentId={activeCommentId}
        isLoading={isCommentsLoading}
        isGeneratePending={isGenerateFeedbackPending}
        canGenerateFeedbackDocument={canGenerateFeedbackDocument}
        error={commentsError}
        onSelectComment={onSelectComment}
        onEditComment={onEditComment}
        onDeleteComment={onDeleteComment}
        onSendToLlm={onSendToLlm}
        onApplyComment={onApplyComment}
        onGenerateFeedbackDocument={onGenerateFeedbackDocument}
        activeTab={activeCommentsTab}
        onTabChange={onCommentsTabChange}
      />
    </div>
  );
}
