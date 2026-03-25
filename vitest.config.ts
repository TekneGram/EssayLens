import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['renderer/src/**/*.test.tsx', 'jsdom']],
    setupFiles: ['./renderer/src/test/setup.ts'],
    include: ['renderer/src/**/*.test.ts', 'renderer/src/**/*.test.tsx', 'electron/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**', 'electron-llm/third_party/**', '.planning/**']
  }
});
