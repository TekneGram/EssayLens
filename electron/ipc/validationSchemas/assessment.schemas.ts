import { z } from 'zod';
import type { FeedbackAnchorDto } from '../contracts/assessment.contracts';

function compareAnchorPosition(a: FeedbackAnchorDto, b: FeedbackAnchorDto): number {
  if (a.paragraphIndex !== b.paragraphIndex) {
    return a.paragraphIndex - b.paragraphIndex;
  }
  if (a.runIndex !== b.runIndex) {
    return a.runIndex - b.runIndex;
  }
  return a.charOffset - b.charOffset;
}

const feedbackAnchorSchema = z.object({
  part: z.string().trim().min(1),
  paragraphIndex: z.number().int().min(0),
  runIndex: z.number().int().min(0),
  charOffset: z.number().int().min(0)
});

const addBlockFeedbackSchema = z.object({
  fileId: z.string().trim().min(1),
  source: z.enum(['teacher', 'llm']),
  kind: z.literal('block'),
  commentText: z.string().trim().min(1)
});

const addInlineFeedbackSchema = z.object({
  fileId: z.string().trim().min(1),
  source: z.enum(['teacher', 'llm']),
  kind: z.literal('inline'),
  commentText: z.string().trim().min(1),
  exactQuote: z.string().trim().min(1),
  prefixText: z.string(),
  suffixText: z.string(),
  startAnchor: feedbackAnchorSchema,
  endAnchor: feedbackAnchorSchema
}).refine(
  (data) => {
    if (data.startAnchor.part !== data.endAnchor.part) return false;
    return compareAnchorPosition(data.startAnchor, data.endAnchor) <= 0;
  },
  { message: 'startAnchor must precede or equal endAnchor securely on same part' }
);

export const assessmentSchemas = {
  extractDocument: z.object({
    fileId: z.string().trim().min(1)
  }),

  listFeedback: z.object({
    fileId: z.string().trim().min(1)
  }),

  addFeedback: z.discriminatedUnion('kind', [addBlockFeedbackSchema, addInlineFeedbackSchema]),

  editFeedback: z.object({
    feedbackId: z.string().trim().min(1),
    commentText: z.string().trim().min(1)
  }),

  deleteFeedback: z.object({
    feedbackId: z.string().trim().min(1)
  }),

  applyFeedback: z.object({
    feedbackId: z.string().trim().min(1),
    applied: z.boolean()
  }),

  sendFeedbackToLlm: z.object({
    feedbackId: z.string().trim().min(1),
    command: z.string().trim().min(1).optional()
  }),

  generateFeedbackDocument: z.object({
    fileId: z.string().trim().min(1)
  }),

  requestLlmAssessment: z.object({
    fileId: z.string().trim().min(1),
    instruction: z.string().trim().min(1).optional()
  })
};
