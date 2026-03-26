export const llmManagerQueryKeys = {
  all: ['llm-manager'] as const,
  catalog: () => ['llm-manager', 'catalog'] as const,
  downloaded: () => ['llm-manager', 'downloaded'] as const,
  activeModel: () => ['llm-manager', 'active-model'] as const,
  settings: () => ['llm-manager', 'settings'] as const
};
