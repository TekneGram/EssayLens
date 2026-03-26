import { z } from 'zod';
import type { ListMessagesRequest, SendChatMessageRequest } from '../contracts/chat.contracts';

export const ListMessagesSchema = z.object({
  fileId: z.string().optional()
}) as z.ZodSchema<ListMessagesRequest>;

export const SendChatMessageSchema = z.preprocess(
  (val: unknown) => {
    if (typeof val !== 'object' || val === null) {
      return val;
    }
    const RecordVal = val as Record<string, unknown>;
    if (!RecordVal.message && typeof RecordVal.content === 'string') {
      return { ...RecordVal, message: RecordVal.content };
    }
    return val;
  },
  z.object({
    fileId: z.string().optional(),
    message: z.string().min(1, 'chat message payload must include a non-empty message'),
    essay: z.string().optional(),
    contextText: z.string().optional(),
    clientRequestId: z.string().optional(),
    sessionId: z.string().optional()
  })
) as z.ZodSchema<SendChatMessageRequest>;
