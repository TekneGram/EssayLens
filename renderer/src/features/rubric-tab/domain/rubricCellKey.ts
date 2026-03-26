import type { CategoryId, CellKey, ScoreId } from '@/features/rubric-tab/domain/rubricModel';

export function createCellKey(categoryId: CategoryId, scoreId: ScoreId): CellKey {
  return `${categoryId}:${scoreId}`;
}
