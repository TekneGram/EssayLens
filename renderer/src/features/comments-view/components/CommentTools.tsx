import type { CommentToolsProps } from '@/features/assessment-tab/types';
import { useCommentToolsController } from '../hooks/useCommentToolsController';
import { SEND_TO_LLM_COMMANDS } from '../domain/commentTools.constants';

export function CommentTools({
  commentId,
  commentText,
  applied,
  onApplyComment,
  onDeleteComment,
  onEditComment,
  onSendToLlm
}: CommentToolsProps) {
  const tools = useCommentToolsController({
    commentId,
    commentText,
    applied,
    onApplyComment,
    onDeleteComment,
    onEditComment,
    onSendToLlm
  });

  return (
    <div className="comment-tools" onClick={(event) => event.stopPropagation()}>
      {tools.isEditing ? (
        <div className="comment-edit-controls">
          <textarea
            className="comment-edit-input"
            aria-label="Edit comment text"
            value={tools.draftText}
            onChange={(event) => tools.setDraftText(event.target.value)}
          />
          <div className="comment-edit-buttons">
            <button type="button" onClick={tools.saveEdit} disabled={!tools.canSave}>
              Save
            </button>
            <button type="button" onClick={tools.cancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={tools.startEdit}>
          Edit
        </button>
      )}
      <button type="button" onClick={tools.deleteComment}>
        Delete
      </button>
      <div className="comment-llm-controls">
        <select aria-label="Send command" value={tools.commandId} onChange={(event) => tools.setCommandId(event.target.value)}>
          {SEND_TO_LLM_COMMANDS.map((command) => (
            <option key={command.id || 'default'} value={command.id}>
              {command.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={tools.sendToLlm}>
          Send to LLM
        </button>
      </div>
      <button type="button" onClick={tools.toggleApplied}>
        {applied ? 'Unapply' : 'Apply'}
      </button>
    </div>
  );
}
