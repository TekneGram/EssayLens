import type { CSSProperties } from 'react';
import { useAssessmentSplitter } from './hooks/useAssessmentSplitter';
import { useAssessmentTabController } from './hooks/useAssessmentTabController';
import type { AssessmentTabChatBindings } from './types';
import { CommentsView } from '@/features/comments-view';
import type { EssayFeedbackSelectionState } from '@/features/essay-feedback-manager/essayFeedbackManager.types';
import { OriginalTextView } from '@/features/original-text-view';
import type { SelectedFileType } from '@/app/types';

const ImageView = () => <div data-testid="image-view">Image View (Not Migrated)</div>;

interface AssessmentTabProps {
  selectedFileType: SelectedFileType;
  essayFeedbackSelection: EssayFeedbackSelectionState;
  onChatBindingsChange?: (bindings: AssessmentTabChatBindings) => void;
}

export function AssessmentTab({
  selectedFileType,
  essayFeedbackSelection,
  onChatBindingsChange
}: AssessmentTabProps) {
  const {
    selectedFileId,
    originalText,
    comments,
    pendingSelection,
    activeCommentSelection,
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
    onApplyAllComments,
    onSendToLlm,
    onGenerateFeedbackDocument,
    onCommentsTabChange,
    onDocumentTextChange,
    onDocumentTextMapChange,
    setSplitRatio
  } = useAssessmentTabController({ selectedFileType, essayFeedbackSelection, onChatBindingsChange });

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
        activeCommentSelection={activeCommentSelection}
        activeCommentId={activeCommentId}
        onSelectionCaptured={onSelectionCaptured}
        onDocumentTextChange={onDocumentTextChange}
        onDocumentTextMapChange={onDocumentTextMapChange}
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
        onApplyAllComments={onApplyAllComments}
        onGenerateFeedbackDocument={onGenerateFeedbackDocument}
        activeTab={activeCommentsTab}
        onTabChange={onCommentsTabChange}
      />
    </div>
  );
}
