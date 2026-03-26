import { canSaveCommentDraft, getTrimmedCommentDraft, toOptionalCommandId } from '../domain/commentTools.logic';

export function canSaveCommentEdit(draftText: string, commentText: string): boolean {
  return canSaveCommentDraft({ draftText, originalText: commentText });
}

export function normalizeEditedCommentText(draftText: string): string {
  return getTrimmedCommentDraft(draftText);
}

export function normalizeSendToLlmCommand(commandId: string): string | undefined {
  return toOptionalCommandId(commandId);
}
