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
      </div>
      <div className="comments-generate-action">
        <button type="button" onClick={onGenerateFeedbackDocument} disabled={!view.isGenerateEnabled}>
          {isGeneratePending ? 'Generating...' : 'Generate'}
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
      </div>
    </section>
  );
}
