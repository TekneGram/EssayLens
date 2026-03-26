import { safeHandle } from '../safeHandle';
import { validateOrThrow } from '../validate';
import { assessmentSchemas } from '../validationSchemas/assessment.schemas';
import { AssessmentService, type AssessmentServiceDeps } from '../../services/assessment/assessmentService';
import { AppException } from '../../core/appException';
import type { IpcMainLike } from '../types';

export const ASSESSMENT_CHANNELS = {
  extractDocument: 'assessment/extractDocument',
  listFeedback: 'assessment/listFeedback',
  addFeedback: 'assessment/addFeedback',
  editFeedback: 'assessment/editFeedback',
  deleteFeedback: 'assessment/deleteFeedback',
  applyFeedback: 'assessment/applyFeedback',
  sendFeedbackToLlm: 'assessment/sendFeedbackToLlm',
  generateFeedbackDocument: 'assessment/generateFeedbackDocument',
  requestLlmAssessment: 'assessment/requestLlmAssessment'
} as const;

export function registerAssessmentHandlers(
  ipcMain: IpcMainLike,
  deps?: Partial<AssessmentServiceDeps>
): void {
  const service = new AssessmentService(deps);

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.extractDocument, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.extractDocument, rawArgs);
    return await service.extractDocument(args.fileId);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.listFeedback, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.listFeedback, rawArgs);
    return await service.listFeedback(args.fileId);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.addFeedback, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.addFeedback, rawArgs);
    return await service.addFeedback(args);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.editFeedback, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.editFeedback, rawArgs);
    return await service.editFeedback(args.feedbackId, args.commentText);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.deleteFeedback, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.deleteFeedback, rawArgs);
    return await service.deleteFeedback(args.feedbackId);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.applyFeedback, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.applyFeedback, rawArgs);
    return await service.applyFeedback(args.feedbackId, args.applied);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.sendFeedbackToLlm, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.sendFeedbackToLlm, rawArgs);
    return await service.sendFeedbackToLlm(args.feedbackId, args.command);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.generateFeedbackDocument, async (rawArgs, _ctx) => {
    const args = validateOrThrow(assessmentSchemas.generateFeedbackDocument, rawArgs);
    return await service.generateFeedbackDocument(args.fileId);
  });

  safeHandle(ipcMain, ASSESSMENT_CHANNELS.requestLlmAssessment, async (rawArgs, _ctx) => {
    validateOrThrow(assessmentSchemas.requestLlmAssessment, rawArgs);
    throw new AppException({
      code: 'NOT_IMPLEMENTED',
      userMessage: 'requestLlmAssessment is not implemented'
    });
  });
}
