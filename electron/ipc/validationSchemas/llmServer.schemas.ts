import { z } from 'zod';
import type {
  StartLlmServerRequest,
  StopLlmServerRequest,
  GetLlmServerStatusRequest
} from '../contracts/llmServer.contracts';

export const StartLlmServerSchema = z.object({}).passthrough() as z.ZodSchema<StartLlmServerRequest>;

export const StopLlmServerSchema = z.object({}).passthrough() as z.ZodSchema<StopLlmServerRequest>;

export const GetLlmServerStatusSchema = z.object({}).passthrough() as z.ZodSchema<GetLlmServerStatusRequest>;
