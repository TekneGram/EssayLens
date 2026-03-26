export const rubricQueryKeys = {
  all: ['rubric'] as const,
  list: () => ['rubric', 'list'] as const,
  matrix: (rubricId: string) => ['rubric', rubricId, 'matrix'] as const,
  fileScores: (fileId: string, rubricId: string) => ['rubric', fileId, rubricId, 'file-scores'] as const,
  gradingContext: (fileId: string) => ['rubric', fileId, 'grading-context'] as const
};
