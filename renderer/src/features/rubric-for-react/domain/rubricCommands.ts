export type RubricCommand =
  | { type: 'setRubricName'; name: string }
  | { type: 'updateCellDescription'; detailId: string; description: string }
  | { type: 'updateCategoryName'; from: string; to: string }
  | { type: 'updateScoreValue'; from: number; to: number }
  | { type: 'deleteCategory'; category: string }
  | { type: 'deleteScore'; value: number }
  | { type: 'createCategory'; name: string }
  | { type: 'createScore'; value: number };
