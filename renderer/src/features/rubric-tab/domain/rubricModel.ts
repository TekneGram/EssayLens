export type RubricId = string;
export type CategoryId = string;
export type ScoreId = string;
export type CellKey = string;

export interface RubricSourceCategory {
  id?: CategoryId;
  name: string;
}

export interface RubricSourceScore {
  id?: ScoreId;
  value: number;
}

export interface RubricSourceCell {
  categoryId: CategoryId;
  scoreId: ScoreId;
  description?: string;
  detailId?: string;
  scoreRowId?: string;
}

export interface RubricSourceData {
  rubricId?: RubricId;
  rubricName?: string;
  categories?: RubricSourceCategory[];
  scores?: RubricSourceScore[];
  cells?: RubricSourceCell[];
}
