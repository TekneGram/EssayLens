import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      // Only flag things that indicate real problems, not style issues
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-debugger': 'error'
    }
  },
  {
    ignores: [
      'dist-electron/**',
      'renderer/dist/**',
      'node_modules/**',
      '**/*.js',
      '**/*.mjs',
      '**/*.cjs'
    ]
  }
];
