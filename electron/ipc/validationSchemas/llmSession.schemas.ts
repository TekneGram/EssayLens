import { z } from 'zod';
import type {
  CreateLlmSessionRequest,
  ClearLlmSessionRequest,
  DeleteLlmSessionRequest,
  GetLlmSessionTurnsRequest,
  ListLlmSessionsByFileRequest
} from '../contracts/llmSession.contracts';

export const CreateLlmSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId must be a non-empty string'),
  fileEntityUuid: z.string().min(1, 'fileEntityUuid must be a non-empty string')
}) as z.ZodSchema<CreateLlmSessionRequest>;

export const ClearLlmSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId must be a non-empty string')
}) as z.ZodSchema<ClearLlmSessionRequest>;

export const DeleteLlmSessionSchema = z.object({
  sessionId: z.string().min(1, 'sessionId must be a non-empty string')
}) as z.ZodSchema<DeleteLlmSessionRequest>;

export const GetLlmSessionTurnsSchema = z.object({
  sessionId: z.string().min(1, 'sessionId must be a non-empty string'),
  fileEntityUuid: z.string().min(1, 'fileEntityUuid must be a non-empty string')
}) as z.ZodSchema<GetLlmSessionTurnsRequest>;

export const ListLlmSessionsByFileSchema = z.object({
  fileEntityUuid: z.string().min(1, 'fileEntityUuid must be a non-empty string')
}) as z.ZodSchema<ListLlmSessionsByFileRequest>;
