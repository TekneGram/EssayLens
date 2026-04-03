import type { CommentsTab } from '@/app/types/primitives';
import type { CommentsViewProps } from '@/features/assessment-tab/types';
import { CommentView } from './components/CommentView';
import { useCommentsViewController } from './hooks/useCommentsViewController';
import { ScoreTool } from '@/features/score-tool';

interface AssessmentCommentsViewProps extends CommentsViewProps {
  activeTab: CommentsTab;
  onTabChange: (tab: CommentsTab) => void;
}

export function CommentsView({
  comments,
  activeCommentId,
  error,
  isLoading,
  isGeneratePending,
  canGenerateFeedbackDocument,
  onApplyComment,
  onDeleteComment,
  onEditComment,
  onGenerateFeedbackDocument,
  onSelectComment,
  onSendToLlm,
  activeTab,
  onTabChange
}: AssessmentCommentsViewProps) {
  const view = useCommentsViewController({
    comments,
    isLoading,
    error,
    isGeneratePending,
    canGenerateFeedbackDocument,
    activeTab,
    onTabChange
  });

  return (
    <section className="comments-view subpane">
      <h4>CommentsView</h4>
      <div role="tablist" aria-label="Comments tabs" className="comments-tabs tabs">
        <button
          type="button"
          className={view.isCommentsActive ? 'tab active is-active' : 'tab'}
          role="tab"
          aria-selected={view.isCommentsActive}
          onClick={view.onSelectCommentsTab}
        >
          Comments
        </button>
        <button
          type="button"
          className={view.isScoreActive ? 'tab active is-active' : 'tab'}
          role="tab"
          aria-selected={view.isScoreActive}
          onClick={view.onSelectScoreTab}
        >
          Score
        </button>
        <button
          type="button"
          className={view.isGenerateActive ? 'tab active is-active' : 'tab'}
          role="tab"
          aria-selected={view.isGenerateActive}
          onClick={view.onSelectGenerateTab}
        >
          Generate
        </button>
      </div>
      <div className="comments-content">
        <div className="content-block comments-panel" role="tabpanel" hidden={!view.isCommentsActive}>
          {isLoading ? <div>Loading comments...</div> : null}
          {error ? <div>{error}</div> : null}
          {view.showEmptyState ? <div>No comments yet.</div> : null}
          {view.showCommentsList ? (
            <div className="comments-list">
              {comments.map((comment) => (
                <CommentView
                  key={comment.id}
                  comment={comment}
                  isActive={activeCommentId === comment.id}
                  onApplyComment={onApplyComment}
                  onDeleteComment={onDeleteComment}
                  onEditComment={onEditComment}
                  onSelectComment={onSelectComment}
                  onSendToLlm={onSendToLlm}
                />
              ))}
            </div>
          ) : null}
        </div>
        <div className="content-block comments-panel" role="tabpanel" hidden={!view.isScoreActive}>
          {view.isScoreActive ? <ScoreTool /> : null}
        </div>
        <div className="content-block comments-panel comments-generate-panel" role="tabpanel" hidden={!view.isGenerateActive}>
          <div className="comments-generate-card">
            <div className="comments-generate-copy">
              <h5>Generate Feedback</h5>
              <p>Create a document that compiles the current comments into a shareable feedback draft.</p>
            </div>
            <button
              type="button"
              className="comments-generate-button"
              onClick={onGenerateFeedbackDocument}
              disabled={!view.isGenerateEnabled}
            >
              {isGeneratePending ? 'Generating feedback document...' : 'Create feedback document'}
            </button>
            {!canGenerateFeedbackDocument ? (
              <p className="comments-generate-hint">Add at least one comment before generating a feedback document.</p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
