export const rubricForReactQueryKeys = {
  list: () => ['rubric', 'list'] as const,
  matrix: (rubricId: string) => ['rubric', rubricId, 'matrix'] as const
};
