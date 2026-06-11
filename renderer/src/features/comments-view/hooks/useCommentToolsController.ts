import { useEffect, useMemo, useReducer, useRef } from 'react';
import type { CommentViewProps } from '@/features/assessment-tab/types';
import { canSaveCommentEdit, normalizeEditedCommentText, normalizeSendToLlmCommand } from '../application/commentTools.service';
import { commentToolsReducer, createInitialCommentToolsState } from '../state/commentTools.state';

interface UseCommentToolsControllerParams {
  commentId: string;
  commentText: string;
  applied: boolean;
  onApplyComment: CommentViewProps['onApplyComment'];
  onDeleteComment: CommentViewProps['onDeleteComment'];
  onEditComment: CommentViewProps['onEditComment'];
  onSendToLlm: CommentViewProps['onSendToLlm'];
}

export type CommentToolsController = ReturnType<typeof useCommentToolsController>;

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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    dispatch({ type: 'commentTools/syncCommentText', payload: commentText });
  }, [commentText]);

  useEffect(() => {
    if (!state.isEditing || !inputRef.current) {
      return;
    }

    inputRef.current.focus();
    inputRef.current.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
  }, [state.isEditing]);

  const canSave = useMemo(() => canSaveCommentEdit(state.draftText, commentText), [state.draftText, commentText]);

  return {
    inputRef,
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
