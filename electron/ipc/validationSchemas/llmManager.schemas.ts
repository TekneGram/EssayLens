import { z } from 'zod';

export const llmManagerSchemas = {
  listCatalogModels: z.unknown(),
  listDownloadedModels: z.unknown(),
  getActiveModel: z.unknown(),
  selectModel: z.unknown(),
  downloadModel: z.unknown(),
  deleteDownloadedModel: z.unknown(),
  getSettings: z.unknown(),
  updateSettings: z.unknown(),
  resetSettingsToDefaults: z.unknown()
};
