import { AppException } from '../../core/appException';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import type { IpcMainLike } from '../types';
import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { rubricSchemas } from '../validationSchemas/rubric.schemas';
import type {
  ClearAppliedRubricResponse,
  CloneRubricResponse,
  CreateRubricResponse,
  DeleteRubricResponse,
  GetFileRubricScoresResponse,
  GetRubricGradingContextResponse,
  GetRubricMatrixResponse,
  ListRubricsResponse,
  SaveFileRubricScoresResponse,
  SetLastUsedRubricResponse,
  UpdateRubricMatrixResponse
} from '../contracts/rubric.contracts';

export const RUBRIC_CHANNELS = {
  listRubrics: 'rubric/listRubrics',
  createRubric: 'rubric/createRubric',
  cloneRubric: 'rubric/cloneRubric',
  deleteRubric: 'rubric/deleteRubric',
  getFileScores: 'rubric/getFileScores',
  saveFileScores: 'rubric/saveFileScores',
  clearAppliedRubric: 'rubric/clearAppliedRubric',
  getGradingContext: 'rubric/getGradingContext',
  getMatrix: 'rubric/getMatrix',
  updateMatrix: 'rubric/updateMatrix',
  setLastUsed: 'rubric/setLastUsed'
} as const;

interface RubricHandlerDeps {
  repository: RubricRepository;
}

function getDefaultDeps(): RubricHandlerDeps {
  return {
    repository: new RubricRepository()
  };
}

export function registerRubricHandlers(ipcMain: IpcMainLike, deps: RubricHandlerDeps = getDefaultDeps()): void {
  safeHandle(ipcMain, RUBRIC_CHANNELS.listRubrics, async () => {
    try {
      const rubrics = await deps.repository.listRubrics();
      const lastUsedRubricId = await deps.repository.getLastUsedRubricId('default');
      return { rubrics, lastUsedRubricId: lastUsedRubricId ?? undefined } satisfies ListRubricsResponse;
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_LIST_FAILED',
        userMessage: 'Could not load rubrics.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.createRubric, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.createRubric, rawArgs);
    try {
      const rubricId = await deps.repository.createRubric(request.name ?? 'New Rubric', 'default');
      return { rubricId } satisfies CreateRubricResponse;
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_CREATE_FAILED',
        userMessage: 'Could not create rubric.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.cloneRubric, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.cloneRubric, rawArgs);
    try {
      const rubricId = await deps.repository.cloneRubric(request.rubricId, 'default');
      if (!rubricId) {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${request.rubricId}.`
        });
      }
      return { rubricId } satisfies CloneRubricResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_CLONE_FAILED',
        userMessage: 'Could not clone rubric.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.deleteRubric, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.deleteRubric, rawArgs);
    try {
      const result = await deps.repository.deleteRubric(request.rubricId);
      if (result === 'not_found') {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${request.rubricId}.`
        });
      }
      if (result === 'active') {
        throw new AppException({
          code: 'RUBRIC_ACTIVE',
          userMessage: 'Active rubrics cannot be deleted.'
        });
      }
      if (result === 'in_use') {
        throw new AppException({
          code: 'RUBRIC_IN_USE',
          userMessage: 'This rubric has been used for scoring and cannot be deleted.'
        });
      }
      return { rubricId: request.rubricId } satisfies DeleteRubricResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_DELETE_FAILED',
        userMessage: 'Could not delete rubric.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.getGradingContext, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.getRubricGradingContext, rawArgs);
    try {
      const context = await deps.repository.getRubricGradingContext(request.fileId);
      return context satisfies GetRubricGradingContextResponse;
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_GET_GRADING_CONTEXT_FAILED',
        userMessage: 'Could not load rubric grading context.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.getFileScores, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.getFileRubricScores, rawArgs);
    try {
      const response = await deps.repository.getFileRubricScores(request.fileId, request.rubricId);
      return response satisfies GetFileRubricScoresResponse;
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_GET_FILE_SCORES_FAILED',
        userMessage: 'Could not load saved file rubric scores.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.saveFileScores, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.saveFileRubricScores, rawArgs);
    try {
      const response = await deps.repository.saveFileRubricScores(request.fileId, request.rubricId, request.selections);
      return response satisfies SaveFileRubricScoresResponse;
    } catch (error) {
      throw new AppException({
        code: 'RUBRIC_SAVE_FILE_SCORES_FAILED',
        userMessage: error instanceof Error ? error.message : 'Could not save file rubric scores.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.clearAppliedRubric, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.clearAppliedRubric, rawArgs);
    try {
      const cleared = await deps.repository.clearAppliedRubricForFilepath(request.fileId, request.rubricId);
      if (!cleared) {
        throw new AppException({
          code: 'RUBRIC_CLEAR_APPLIED_NOT_FOUND',
          userMessage: 'No applied rubric was found for this file path and rubric.'
        });
      }
      return cleared satisfies ClearAppliedRubricResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_CLEAR_APPLIED_FAILED',
        userMessage: 'Could not clear applied rubric and scores.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.getMatrix, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.getRubricMatrix, rawArgs);
    try {
      const matrix = await deps.repository.getRubricMatrix(request.rubricId);
      if (!matrix) {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${request.rubricId}.`
        });
      }
      return matrix satisfies GetRubricMatrixResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_GET_MATRIX_FAILED',
        userMessage: 'Could not load rubric matrix.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.updateMatrix, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.updateRubricMatrix, rawArgs);
    try {
      const updated = await deps.repository.updateRubricMatrix(request.rubricId, request.operation);
      if (updated === 'not_found') {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${request.rubricId}.`
        });
      }
      if (updated === 'archived') {
        throw new AppException({
          code: 'RUBRIC_ARCHIVED',
          userMessage: 'Archived rubrics cannot be edited.'
        });
      }
      if (updated === 'inactive') {
        throw new AppException({
          code: 'RUBRIC_INACTIVE',
          userMessage: 'This rubric is locked because it has been used and cannot be edited.'
        });
      }
      return { success: true } satisfies UpdateRubricMatrixResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_UPDATE_MATRIX_FAILED',
        userMessage: 'Could not update rubric matrix.',
        details: error
      });
    }
  });

  safeHandle(ipcMain, RUBRIC_CHANNELS.setLastUsed, async (rawArgs) => {
    const request = validateOrThrow(rubricSchemas.setLastUsedRubric, rawArgs);
    try {
      const updated = await deps.repository.setLastUsedRubricId(request.rubricId, 'default');
      if (!updated) {
        throw new AppException({
          code: 'RUBRIC_NOT_FOUND',
          userMessage: `Rubric not found for id ${request.rubricId}.`
        });
      }
      return { rubricId: request.rubricId } satisfies SetLastUsedRubricResponse;
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'RUBRIC_SET_LAST_USED_FAILED',
        userMessage: 'Could not set last used rubric.',
        details: error
      });
    }
  });
}
