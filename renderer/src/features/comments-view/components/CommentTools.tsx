import type { RefObject } from 'react';
import { SEND_TO_LLM_COMMANDS } from '../domain/commentTools.constants';

export interface CommentToolsViewProps {
  applied: boolean;
  isEditing: boolean;
  draftText: string;
  canSave: boolean;
  commandId: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onDraftTextChange: (text: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDeleteComment: () => void;
  onSendToLlm: () => void;
  onCommandChange: (nextCommandId: string) => void;
  onToggleApplied: () => void;
}

export function CommentTools({
  applied,
  isEditing,
  draftText,
  canSave,
  commandId,
  inputRef,
  onDraftTextChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDeleteComment,
  onSendToLlm,
  onCommandChange,
  onToggleApplied
}: CommentToolsViewProps) {
  return (
    <div
      className={isEditing ? 'comment-tools comment-tools--editing' : 'comment-tools'}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onKeyUp={(event) => event.stopPropagation()}
    >
      {isEditing ? (
        <div className="comment-edit-controls">
          <textarea
            ref={inputRef}
            className="comment-edit-input"
            aria-label="Edit comment text"
            value={draftText}
            onChange={(event) => onDraftTextChange(event.target.value)}
          />
          <div className="comment-edit-buttons">
            <button type="button" className="comment-tool-button comment-tool-button--primary" onClick={onSaveEdit} disabled={!canSave}>
              Save
            </button>
            <button type="button" className="comment-tool-button" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button type="button" className="comment-tool-button" onClick={onStartEdit}>
            Edit
          </button>
          <button type="button" className="comment-tool-button comment-tool-button--danger" onClick={onDeleteComment}>
            Delete
          </button>
          <div className="comment-llm-controls">
            <select
              className="comment-tool-select"
              aria-label="Send command"
              value={commandId}
              onChange={(event) => onCommandChange(event.target.value)}
            >
              {SEND_TO_LLM_COMMANDS.map((command) => (
                <option key={command.id || 'default'} value={command.id}>
                  {command.label}
                </option>
              ))}
            </select>
            <button type="button" className="comment-tool-button comment-tool-button--primary" onClick={onSendToLlm}>
              Send to LLM
            </button>
          </div>
          <button type="button" className="comment-tool-button comment-tool-button--accent" onClick={onToggleApplied}>
            {applied ? 'Unapply' : 'Apply'}
          </button>
        </>
      )}
    </div>
  );
}
