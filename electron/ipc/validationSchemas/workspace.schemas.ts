import { z } from 'zod';

export const workspaceSchemas = {
  listFiles: z.object({ folderId: z.string() }),
  selectFolder: z.object({}).optional(),
  getCurrentFolder: z.object({}).optional(),
};
