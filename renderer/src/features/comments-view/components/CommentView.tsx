import type { CommentViewProps } from '@/features/assessment-tab/types';
import { useCommentViewController } from '../hooks/useCommentViewController';
import { CommentBody } from './CommentBody';
import { CommentHeader } from './CommentHeader';
import { CommentTools } from './CommentTools';
import { useCommentToolsController } from '../hooks/useCommentToolsController';

export function CommentView({
  comment,
  isActive,
  onApplyComment,
  onDeleteComment,
  onEditComment,
  onSelectComment,
  onSendToLlm
}: CommentViewProps) {
  const view = useCommentViewController({ comment, onSelectComment });
  const tools = useCommentToolsController({
    commentId: comment.id,
    commentText: comment.commentText,
    applied: Boolean(comment.applied),
    onApplyComment,
    onDeleteComment,
    onEditComment,
    onSendToLlm
  });
  return (
    <article
      className={isActive ? 'comment-view is-active' : 'comment-view'}
      data-comment-id={comment.id}
      data-active={isActive ? 'true' : 'false'}
      onClick={view.onSelect}
      onKeyDown={view.onKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Select ${view.title}`}
    >
      <CommentHeader comment={comment} title={view.title} isActive={isActive} />
      {tools.isEditing ? (
        <CommentTools
          applied={Boolean(comment.applied)}
          isEditing={tools.isEditing}
          draftText={tools.draftText}
          canSave={tools.canSave}
          commandId={tools.commandId}
          inputRef={tools.inputRef}
          onDraftTextChange={tools.setDraftText}
          onStartEdit={tools.startEdit}
          onSaveEdit={tools.saveEdit}
          onCancelEdit={tools.cancelEdit}
          onDeleteComment={tools.deleteComment}
          onSendToLlm={tools.sendToLlm}
          onCommandChange={tools.setCommandId}
          onToggleApplied={tools.toggleApplied}
        />
      ) : (
        <>
          <CommentBody comment={comment} />
          <CommentTools
            applied={Boolean(comment.applied)}
            isEditing={tools.isEditing}
            draftText={tools.draftText}
            canSave={tools.canSave}
            commandId={tools.commandId}
            inputRef={tools.inputRef}
            onDraftTextChange={tools.setDraftText}
            onStartEdit={tools.startEdit}
            onSaveEdit={tools.saveEdit}
            onCancelEdit={tools.cancelEdit}
            onDeleteComment={tools.deleteComment}
            onSendToLlm={tools.sendToLlm}
            onCommandChange={tools.setCommandId}
            onToggleApplied={tools.toggleApplied}
          />
        </>
      )}
    </article>
  );
}
