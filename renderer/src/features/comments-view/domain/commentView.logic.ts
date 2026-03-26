export function createFallbackTitle(commentId: string, kind: 'inline' | 'block'): string {
  return `${kind === 'inline' ? 'Inline' : 'Block'} comment ${commentId.slice(0, 8)}`;
}

export function isCommentSelectKey(key: string): boolean {
  return key === 'Enter' || key === ' ';
}
