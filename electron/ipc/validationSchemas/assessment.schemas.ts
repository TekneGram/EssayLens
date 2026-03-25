import { z } from 'zod';

export const assessmentSchemas = {
  extractDocument: z.unknown(),
  listFeedback: z.unknown(),
  addFeedback: z.unknown(),
  editFeedback: z.unknown(),
  deleteFeedback: z.unknown(),
  applyFeedback: z.unknown(),
  sendFeedbackToLlm: z.unknown(),
  generateFeedbackDocument: z.unknown(),
  requestLlmAssessment: z.unknown()
};
