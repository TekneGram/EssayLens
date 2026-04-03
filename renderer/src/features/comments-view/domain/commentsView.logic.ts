import type { CommentsTab } from '@/app/providers/state';
import type { FeedbackItem } from '@/features/feedback/domain';

export function isCommentsTabActive(activeTab: CommentsTab): boolean {
  return activeTab === 'comments';
}

export function isScoreTabActive(activeTab: CommentsTab): boolean {
  return activeTab === 'score';
}

export function isGenerateTabActive(activeTab: CommentsTab): boolean {
  return activeTab === 'generate';
}

export function canGenerateDocument(canGenerateFeedbackDocument: boolean, isGeneratePending: boolean): boolean {
  return canGenerateFeedbackDocument && !isGeneratePending;
}

export function shouldShowEmptyCommentsState(args: {
  isLoading: boolean;
  error?: string;
  comments: FeedbackItem[];
}): boolean {
  return !args.isLoading && !args.error && args.comments.length === 0;
}

export function shouldRenderCommentsList(comments: FeedbackItem[]): boolean {
  return comments.length > 0;
}
