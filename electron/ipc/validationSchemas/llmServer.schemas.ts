import { z } from 'zod';

export const llmServerSchemas = {
  startLlmServer: z.unknown(),
  stopLlmServer: z.unknown(),
  getLlmServerStatus: z.unknown()
};
