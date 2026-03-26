export function canSaveCommentDraft(args: { draftText: string; originalText: string }): boolean {
  const trimmedDraft = args.draftText.trim();
  return trimmedDraft.length > 0 && trimmedDraft !== args.originalText;
}

export function getTrimmedCommentDraft(draftText: string): string {
  return draftText.trim();
}

export function toOptionalCommandId(commandId: string): string | undefined {
  return commandId || undefined;
}
