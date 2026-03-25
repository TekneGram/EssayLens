import { z } from 'zod';

export const rubricSchemas = {
  listRubrics: z.unknown(),
  createRubric: z.unknown(),
  getRubricMatrix: z.unknown(),
  updateRubricMatrix: z.unknown(),
  setLastUsedRubric: z.unknown(),
  cloneRubric: z.unknown(),
  deleteRubric: z.unknown(),
  getFileRubricScores: z.unknown(),
  saveFileRubricScores: z.unknown(),
  getRubricGradingContext: z.unknown(),
  clearAppliedRubric: z.unknown()
};
