import { z } from 'zod';

const updateOperationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setRubricName'), name: z.string().min(1) }),
  z.object({ type: z.literal('updateCellDescription'), detailId: z.string().min(1), description: z.string() }),
  z.object({ type: z.literal('updateCategoryName'), from: z.string().min(1), to: z.string().min(1) }),
  z.object({ type: z.literal('updateScoreValue'), from: z.number().finite(), to: z.number().finite() }),
  z.object({ type: z.literal('deleteCategory'), category: z.string().min(1) }),
  z.object({ type: z.literal('deleteScore'), value: z.number().finite() }),
  z.object({ type: z.literal('createCategory'), name: z.string().min(1) }),
  z.object({ type: z.literal('createScore'), value: z.number().finite() })
]);

export const rubricSchemas = {
  listRubrics: z.unknown().optional(),
  createRubric: z.object({
    name: z.string().optional()
  }).optional().default({}),
  getRubricMatrix: z.object({
    rubricId: z.string().min(1)
  }),
  updateRubricMatrix: z.object({
    rubricId: z.string().min(1),
    operation: updateOperationSchema
  }),
  setLastUsedRubric: z.object({
    rubricId: z.string().min(1)
  }),
  cloneRubric: z.object({
    rubricId: z.string().min(1)
  }),
  deleteRubric: z.object({
    rubricId: z.string().min(1)
  }),
  getFileRubricScores: z.object({
    fileId: z.string().min(1),
    rubricId: z.string().min(1)
  }),
  saveFileRubricScores: z.object({
    fileId: z.string().min(1),
    rubricId: z.string().min(1),
    selections: z.array(z.object({
      rubricDetailId: z.string().min(1),
      assignedScore: z.string().min(1)
    }))
  }),
  getRubricGradingContext: z.object({
    fileId: z.string().min(1)
  }),
  clearAppliedRubric: z.object({
    fileId: z.string().min(1),
    rubricId: z.string().min(1)
  })
};
