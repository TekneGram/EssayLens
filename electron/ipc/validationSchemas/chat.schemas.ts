import { z } from 'zod';
import type {
  CheckParagraphFeedbackCompletionsRequest,
  ListMessagesRequest,
  SendChatMessageRequest
} from '../contracts/chat.contracts';

export const ListMessagesSchema = z.object({
  fileId: z.string().optional()
}) as z.ZodSchema<ListMessagesRequest>;

export const CheckParagraphFeedbackCompletionsSchema = z.object({
  fileIds: z.array(z.string().trim().min(1)).min(1, 'completion check payload must include at least one fileId'),
  workflowKey: z.enum(['paragraph_feedback', 'essay_feedback']).optional()
}) as z.ZodSchema<CheckParagraphFeedbackCompletionsRequest>;

const sendChatMessageSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('chat'),
    fileId: z.string().optional(),
    message: z.string().min(1, 'chat message payload must include a non-empty message'),
    essay: z.string().optional(),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional(),
    rubricId: z.string().optional(),
    systemPrompt: z.string().optional()
  }),
  z.object({
    kind: z.literal('rubric-feedback'),
    fileId: z.string().min(1, 'rubric feedback payload must include a fileId'),
    message: z.string().optional(),
    essay: z.string().min(1, 'rubric feedback payload must include essay text'),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional(),
    rubricId: z.string().optional(),
    systemPrompt: z.string().optional()
  }),
  z.object({
    kind: z.literal('paragraph-feedback-bulk'),
    fileId: z.string().optional(),
    fileIds: z.array(z.string().trim().min(1)).min(1, 'paragraph feedback bulk payload must include at least one fileId'),
    redoCompletedFileIds: z.array(z.string().trim().min(1)).optional(),
    message: z.string().optional(),
    essay: z.string().optional(),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional(),
    rubricId: z.string().optional(),
    systemPrompt: z.string().optional()
  }),
  z.object({
    kind: z.literal('essay-feedback'),
    fileId: z.string().min(1, 'essay feedback payload must include a fileId'),
    selectedFeedbackTypes: z
      .array(
        z.enum([
          'thesis-statement-feedback',
          'summarize-main-idea',
          'paragraph-evaluation',
          'thesis-restatement-feedback',
          'summary-feedback',
          'conclusion-final-comment'
        ])
      )
      .min(1, 'essay feedback payload must include at least one selected feedback type'),
    fileIds: z.array(z.string()).optional(),
    redoCompletedFileIds: z.array(z.string()).optional(),
    message: z.string().optional(),
    essay: z.string().optional(),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional(),
    rubricId: z.string().optional(),
    systemPrompt: z.string().optional()
  }),
  z.object({
    kind: z.literal('essay-feedback-bulk'),
    fileIds: z.array(z.string().trim().min(1)).min(1, 'essay feedback bulk payload must include at least one fileId'),
    selectedFeedbackTypes: z
      .array(
        z.enum([
          'thesis-statement-feedback',
          'summarize-main-idea',
          'paragraph-evaluation',
          'thesis-restatement-feedback',
          'summary-feedback',
          'conclusion-final-comment'
        ])
      )
      .min(1, 'essay feedback bulk payload must include at least one selected feedback type'),
    redoCompletedFileIds: z.array(z.string().trim().min(1)).optional(),
    fileId: z.string().optional(),
    message: z.string().optional(),
    essay: z.string().optional(),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional(),
    rubricId: z.string().optional(),
    systemPrompt: z.string().optional()
  })
]);

export const SendChatMessageSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== 'object' || val === null) {
      return val;
    }
    const recordVal = val as Record<string, unknown>;
    const kind =
      recordVal.kind === 'rubric-feedback'
        ? 'rubric-feedback'
        : recordVal.kind === 'paragraph-feedback-bulk'
          ? 'paragraph-feedback-bulk'
          : recordVal.kind === 'essay-feedback'
            ? 'essay-feedback'
            : recordVal.kind === 'essay-feedback-bulk'
              ? 'essay-feedback-bulk'
          : 'chat';
    if (!recordVal.message && typeof recordVal.content === 'string') {
      return { ...recordVal, kind, message: recordVal.content };
    }
    return { ...recordVal, kind };
  },
  sendChatMessageSchema
) as z.ZodSchema<SendChatMessageRequest>;
