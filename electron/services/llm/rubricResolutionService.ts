import { AppException } from '../../core/appException';
import type { GetRubricGradingContextResponse, GetRubricMatrixResponse } from '../../ipc/contracts/rubric.contracts';
import type { ChatServiceDeps, RubricFeedbackRequest } from './chatService.shared';

export class RubricResolutionService {
  constructor(private readonly deps: Pick<ChatServiceDeps, 'rubricRepository'>) {}

  async resolveRubricIdForFeedback(request: RubricFeedbackRequest): Promise<string> {
    if (typeof request.rubricId === 'string' && request.rubricId.trim()) {
      return request.rubricId.trim();
    }

    let context: GetRubricGradingContextResponse;
    try {
      context = await this.deps.rubricRepository.getRubricGradingContext(request.fileId);
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_GET_GRADING_CONTEXT_FAILED',
        userMessage: 'Could not resolve the rubric for rubric feedback.',
        details: error
      });
    }

    const resolvedRubricId = context.selectedRubricIdForFile ?? context.lockedRubricId;
    if (resolvedRubricId) {
      return resolvedRubricId;
    }

    throw new AppException({
      code: 'RUBRIC_FEEDBACK_NO_SELECTED_RUBRIC',
      userMessage: 'Select a rubric before requesting rubric-based comments.',
      details: context
    });
  }

  async loadRubricMatrix(rubricId: string): Promise<GetRubricMatrixResponse> {
    try {
      const matrix = await this.deps.rubricRepository.getRubricMatrix(rubricId);
      if (!matrix) {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${rubricId}.`
        });
      }
      return matrix;
    } catch (error) {
      if (error instanceof AppException) {
        throw error;
      }
      throw new AppException({
        code: 'RUBRIC_GET_MATRIX_FAILED',
        userMessage: 'Could not load rubric matrix.',
        details: error
      });
    }
  }
}
