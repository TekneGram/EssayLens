import { useEffect, useMemo, useReducer } from 'react';
import type { CommentToolsProps } from '@/features/assessment-tab/types';
import { canSaveCommentEdit, normalizeEditedCommentText, normalizeSendToLlmCommand } from '../application/commentTools.service';
import { commentToolsReducer, createInitialCommentToolsState } from '../state/commentTools.state';

interface UseCommentToolsControllerParams {
  commentId: CommentToolsProps['commentId'];
  commentText: CommentToolsProps['commentText'];
  applied: CommentToolsProps['applied'];
  onApplyComment: CommentToolsProps['onApplyComment'];
  onDeleteComment: CommentToolsProps['onDeleteComment'];
  onEditComment: CommentToolsProps['onEditComment'];
  onSendToLlm: CommentToolsProps['onSendToLlm'];
}

export function useCommentToolsController({
  commentId,
  commentText,
  applied,
  onApplyComment,
  onDeleteComment,
  onEditComment,
  onSendToLlm
}: UseCommentToolsControllerParams) {
  const [state, dispatch] = useReducer(commentToolsReducer, createInitialCommentToolsState(commentText));

  useEffect(() => {
    dispatch({ type: 'commentTools/syncCommentText', payload: commentText });
  }, [commentText]);

  const canSave = useMemo(() => canSaveCommentEdit(state.draftText, commentText), [state.draftText, commentText]);

  return {
    isEditing: state.isEditing,
    draftText: state.draftText,
    commandId: state.commandId,
    canSave,
    startEdit: () => dispatch({ type: 'commentTools/startEdit' }),
    setDraftText: (text: string) => dispatch({ type: 'commentTools/setDraftText', payload: text }),
    saveEdit: () => {
      if (!canSave) {
        return;
      }
      onEditComment(commentId, normalizeEditedCommentText(state.draftText));
      dispatch({ type: 'commentTools/saveComplete' });
    },
    cancelEdit: () => dispatch({ type: 'commentTools/cancelEdit', payload: { commentText } }),
    deleteComment: () => onDeleteComment(commentId),
    setCommandId: (nextCommandId: string) => dispatch({ type: 'commentTools/setCommandId', payload: nextCommandId }),
    sendToLlm: () => onSendToLlm(commentId, normalizeSendToLlmCommand(state.commandId)),
    toggleApplied: () => onApplyComment(commentId, !applied)
  };
}
