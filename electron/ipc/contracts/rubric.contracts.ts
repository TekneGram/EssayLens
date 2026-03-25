export type RubricType = 'flat' | 'detailed';

export interface RubricDto {
  entityUuid: string;
  name: string;
  type: RubricType;
  isActive: boolean;
  isArchived: boolean;
}

export interface RubricDetailDto {
  uuid: string;
  entityUuid: string;
  category: string;
  description: string;
}

export interface RubricScoreDto {
  uuid: string;
  detailsUuid: string;
  scoreValues: number;
}

export interface FileRubricInstanceDto {
  uuid: string;
  fileEntityUuid: string;
  rubricEntityUuid: string;
  createdAt: string;
  editedAt?: string;
}

export interface FileRubricScoreDto {
  uuid: string;
  rubricInstanceUuid: string;
  rubricDetailUuid: string;
  assignedScore: string;
  createdAt: string;
  editedAt?: string;
}

export interface ListRubricsResponse {
  rubrics: RubricDto[];
  lastUsedRubricId?: string;
}

export interface CreateRubricRequest {
  name?: string;
}

export interface CreateRubricResponse {
  rubricId: string;
}

export interface GetRubricMatrixRequest {
  rubricId: string;
}

export interface GetRubricMatrixResponse {
  rubric: RubricDto;
  details: RubricDetailDto[];
  scores: RubricScoreDto[];
}

export type UpdateRubricOperation =
  | { type: 'setRubricName'; name: string }
  | { type: 'updateCellDescription'; detailId: string; description: string }
  | { type: 'updateCategoryName'; from: string; to: string }
  | { type: 'updateScoreValue'; from: number; to: number }
  | { type: 'deleteCategory'; category: string }
  | { type: 'deleteScore'; value: number }
  | { type: 'createCategory'; name: string }
  | { type: 'createScore'; value: number };

export interface UpdateRubricMatrixRequest {
  rubricId: string;
  operation: UpdateRubricOperation;
}

export interface UpdateRubricMatrixResponse {
  success: true;
}

export interface SetLastUsedRubricRequest {
  rubricId: string;
}

export interface SetLastUsedRubricResponse {
  rubricId: string;
}

export interface CloneRubricRequest {
  rubricId: string;
}

export interface CloneRubricResponse {
  rubricId: string;
}

export interface DeleteRubricRequest {
  rubricId: string;
}

export interface DeleteRubricResponse {
  rubricId: string;
}

export interface GetFileRubricScoresRequest {
  fileId: string;
  rubricId: string;
}

export interface GetFileRubricScoresResponse {
  instance: FileRubricInstanceDto | null;
  scores: FileRubricScoreDto[];
}

export interface SaveFileRubricScoresRequest {
  fileId: string;
  rubricId: string;
  selections: Array<{
    rubricDetailId: string;
    assignedScore: string;
  }>;
}

export interface SaveFileRubricScoresResponse {
  instance: FileRubricInstanceDto;
  scores: FileRubricScoreDto[];
}

export interface GetRubricGradingContextRequest {
  fileId: string;
}

export interface GetRubricGradingContextResponse {
  fileId: string;
  lockedRubricId?: string;
  selectedRubricIdForFile?: string;
}

export interface ClearAppliedRubricRequest {
  fileId: string;
  rubricId: string;
}

export interface ClearAppliedRubricResponse {
  fileId: string;
  filepathId: string;
  clearedRubricId: string;
}
