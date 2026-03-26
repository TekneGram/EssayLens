export const assessmentQueryKeys = {
  feedbackList: (fileId: string) => ['assessment', 'feedback', fileId] as const
};
