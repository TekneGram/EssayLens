import { z } from 'zod';

export const llmSessionSchemas = {
  createLlmSession: z.unknown(),
  clearLlmSession: z.unknown(),
  deleteLlmSession: z.unknown(),
  getLlmSessionTurns: z.unknown(),
  listLlmSessionsByFile: z.unknown()
};
