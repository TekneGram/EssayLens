import { z } from 'zod';

export const workspaceSchemas = {
  selectFolder: z.unknown(),
  listFiles: z.unknown(),
  getCurrentFolder: z.unknown()
};
