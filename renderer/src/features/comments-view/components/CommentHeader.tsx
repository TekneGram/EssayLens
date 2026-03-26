import type { CommentHeaderProps } from '@/features/assessment-tab/types';

export function CommentHeader({ title, comment, isActive }: CommentHeaderProps) {
  const createdAt = new Date(comment.createdAt).toLocaleString();
  return (
    <header className="comment-header">
      <strong className="comment-title">{title}</strong>
      <div className="comment-meta">
        <span className={`comment-source source-${comment.source}`}>{comment.source}</span>
        <span className={`comment-kind kind-${comment.kind}`}>{comment.kind}</span>
        <span className="comment-created-at">{createdAt}</span>
        {isActive ? <span className="comment-active-pill">Active</span> : null}
      </div>
    </header>
  );
}
