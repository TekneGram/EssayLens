export interface CommentToolsState {
  isEditing: boolean;
  draftText: string;
  commandId: string;
}

export type CommentToolsAction =
  | { type: 'commentTools/startEdit' }
  | { type: 'commentTools/cancelEdit'; payload: { commentText: string } }
  | { type: 'commentTools/setDraftText'; payload: string }
  | { type: 'commentTools/setCommandId'; payload: string }
  | { type: 'commentTools/syncCommentText'; payload: string }
  | { type: 'commentTools/saveComplete' };

export function createInitialCommentToolsState(commentText: string): CommentToolsState {
  return {
    isEditing: false,
    draftText: commentText,
    commandId: ''
  };
}

export function commentToolsReducer(state: CommentToolsState, action: CommentToolsAction): CommentToolsState {
  switch (action.type) {
    case 'commentTools/startEdit':
      return {
        ...state,
        isEditing: true
      };
    case 'commentTools/cancelEdit':
      return {
        ...state,
        isEditing: false,
        draftText: action.payload.commentText
      };
    case 'commentTools/setDraftText':
      return {
        ...state,
        draftText: action.payload
      };
    case 'commentTools/setCommandId':
      return {
        ...state,
        commandId: action.payload
      };
    case 'commentTools/syncCommentText':
      return {
        ...state,
        draftText: action.payload
      };
    case 'commentTools/saveComplete':
      return {
        ...state,
        isEditing: false
      };
    default:
      return state;
  }
}
