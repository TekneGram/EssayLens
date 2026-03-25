import { QueryClient } from '@tanstack/react-query';

export function createAppQueryClient(): QueryClient {
  const isVitest = typeof process !== 'undefined' && process.env.VITEST === 'true';
  const gcTime = isVitest ? Infinity : undefined;

  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime
      },
      mutations: {
        retry: false,
        gcTime
      }
    }
  });
}
