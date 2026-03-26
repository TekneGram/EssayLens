import type { GetRubricMatrixResponse, RubricDetailDto, RubricScoreDto } from '@/app/ports/rubric.port';
import type { RubricSourceData } from '@/features/rubric-for-react/domain';

const makeKey = (categoryId: string, scoreId: string): string => `${categoryId}:${scoreId}`;

export function matrixToRubricSourceData(matrix: GetRubricMatrixResponse): RubricSourceData {
  const scoreByDetailId: Record<string, RubricScoreDto> = {};
  for (const score of matrix.scores) {
    scoreByDetailId[score.detailsUuid] = score;
  }

  const detailsByCategory = new Map<string, RubricDetailDto[]>();
  const scoresByValue = new Map<number, RubricScoreDto[]>();

  for (const detail of matrix.details) {
    const score = scoreByDetailId[detail.uuid];
    if (!score) continue;
    const categoryDetails = detailsByCategory.get(detail.category) ?? [];
    categoryDetails.push(detail);
    detailsByCategory.set(detail.category, categoryDetails);

    const scoreRows = scoresByValue.get(score.scoreValues) ?? [];
    scoreRows.push(score);
    scoresByValue.set(score.scoreValues, scoreRows);
  }

  const categoryNames = Array.from(detailsByCategory.keys()).sort((left, right) => left.localeCompare(right));
  const categoryIdByName = new Map<string, string>();
  for (const categoryName of categoryNames) {
    const details = detailsByCategory.get(categoryName) ?? [];
    const representativeDetail = [...details].sort((left, right) => left.uuid.localeCompare(right.uuid))[0];
    const stableId = representativeDetail ? `cat:${representativeDetail.uuid}` : `cat:${categoryName}`;
    categoryIdByName.set(categoryName, stableId);
  }

  const scoreValues = Array.from(scoresByValue.keys()).sort((left, right) => right - left);
  const scoreIdByValue = new Map<number, string>();
  for (const scoreValue of scoreValues) {
    const scoreRows = scoresByValue.get(scoreValue) ?? [];
    const representativeScore = [...scoreRows].sort((left, right) => left.uuid.localeCompare(right.uuid))[0];
    const stableId = representativeScore ? `score:${representativeScore.uuid}` : `score:${scoreValue}`;
    scoreIdByValue.set(scoreValue, stableId);
  }

  const categories = categoryNames.map((name) => ({
    id: categoryIdByName.get(name) ?? `cat:${name}`,
    name
  }));
  const scores = scoreValues
    .sort((left, right) => right - left)
    .map((value) => ({ id: scoreIdByValue.get(value) ?? `score:${value}`, value }));

  const cells: NonNullable<RubricSourceData['cells']> = [];
  for (const detail of matrix.details) {
    const score = scoreByDetailId[detail.uuid];
    if (!score) continue;
    const categoryId = categoryIdByName.get(detail.category);
    const scoreId = scoreIdByValue.get(score.scoreValues);
    if (!categoryId || !scoreId) continue;
    cells.push({
      categoryId,
      scoreId,
      detailId: detail.uuid,
      scoreRowId: score.uuid,
      description: detail.description ?? ''
    });
  }

  for (const category of categories) {
    for (const score of scores) {
      const key = makeKey(category.id, score.id);
      const exists = cells.some((cell) => makeKey(cell.categoryId, cell.scoreId) === key);
      if (!exists) {
        cells.push({
          categoryId: category.id,
          scoreId: score.id,
          detailId: `temp_detail:${key}`,
          scoreRowId: `temp_score:${key}`,
          description: ''
        });
      }
    }
  }

  return {
    rubricId: matrix.rubric.entityUuid,
    rubricName: matrix.rubric.name,
    categories,
    scores,
    cells
  };
}
