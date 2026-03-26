import type {
  CategoryId,
  CellKey,
  NormalizedRubric,
  RubricSourceData,
  ScoreId
} from '@/features/rubric-for-react/domain/rubricModel';

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Math.random().toString(16).slice(2)}`;
}

function makeCellKey(categoryId: CategoryId, scoreId: ScoreId): CellKey {
  return `${categoryId}:${scoreId}`;
}

function toNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function isNormalizedRubric(value: RubricSourceData | NormalizedRubric): value is NormalizedRubric {
  const candidate = value as Partial<NormalizedRubric>;
  return Boolean(
    candidate &&
      candidate.categoryOrder &&
      candidate.scoreOrder &&
      candidate.categoriesById &&
      candidate.scoresById &&
      candidate.cellsByKey
  );
}

export function normalizeRubric(input?: RubricSourceData | NormalizedRubric): NormalizedRubric {
  if (!input) {
    return {
      rubricId: createId('rubric'),
      rubricName: 'Untitled Rubric',
      categoryOrder: [],
      scoreOrder: [],
      categoriesById: {},
      scoresById: {},
      cellsByKey: {}
    };
  }

  if (isNormalizedRubric(input)) {
    const categoriesById = { ...input.categoriesById };
    const scoresById = { ...input.scoresById };
    const categoryOrder = [...input.categoryOrder].filter((id) => Boolean(categoriesById[id]));
    const scoreOrder = [...input.scoreOrder].filter((id) => Boolean(scoresById[id]));
    const cellsByKey = { ...input.cellsByKey };

    for (const categoryId of categoryOrder) {
      for (const scoreId of scoreOrder) {
        const key = makeCellKey(categoryId, scoreId);
        if (!cellsByKey[key]) {
          cellsByKey[key] = { key, categoryId, scoreId, description: '' };
        }
      }
    }

    return {
      rubricId: input.rubricId,
      rubricName: input.rubricName,
      categoryOrder,
      scoreOrder,
      categoriesById,
      scoresById,
      cellsByKey
    };
  }

  const categoriesById: NormalizedRubric['categoriesById'] = {};
  const scoresById: NormalizedRubric['scoresById'] = {};
  const categoryOrder: CategoryId[] = [];
  const scoreOrder: ScoreId[] = [];

  for (let index = 0; index < (input.categories?.length ?? 0); index += 1) {
    const category = input.categories?.[index];
    if (!category) continue;
    const id = category.id ?? `category:${index}:${createId('c')}`;
    if (categoriesById[id]) continue;
    categoriesById[id] = { id, name: category.name };
    categoryOrder.push(id);
  }

  for (let index = 0; index < (input.scores?.length ?? 0); index += 1) {
    const score = input.scores?.[index];
    if (!score) continue;
    const id = score.id ?? `score:${index}:${createId('s')}`;
    if (scoresById[id]) continue;
    scoresById[id] = { id, value: toNumber(score.value) };
    scoreOrder.push(id);
  }

  scoreOrder.sort((a, b) => scoresById[b].value - scoresById[a].value);

  const cellsByKey: NormalizedRubric['cellsByKey'] = {};
  for (const cell of input.cells ?? []) {
    if (!categoriesById[cell.categoryId] || !scoresById[cell.scoreId]) continue;
    const key = makeCellKey(cell.categoryId, cell.scoreId);
    cellsByKey[key] = {
      key,
      categoryId: cell.categoryId,
      scoreId: cell.scoreId,
      description: cell.description ?? '',
      detailId: cell.detailId,
      scoreRowId: cell.scoreRowId
    };
  }

  for (const categoryId of categoryOrder) {
    for (const scoreId of scoreOrder) {
      const key = makeCellKey(categoryId, scoreId);
      if (!cellsByKey[key]) {
        cellsByKey[key] = {
          key,
          categoryId,
          scoreId,
          description: ''
        };
      }
    }
  }

  return {
    rubricId: input.rubricId ?? createId('rubric'),
    rubricName: input.rubricName ?? 'Untitled Rubric',
    categoryOrder,
    scoreOrder,
    categoriesById,
    scoresById,
    cellsByKey
  };
}

export function createCellKey(categoryId: CategoryId, scoreId: ScoreId): CellKey {
  return makeCellKey(categoryId, scoreId);
}

export function createEntityId(prefix: string): string {
  return createId(prefix);
}
