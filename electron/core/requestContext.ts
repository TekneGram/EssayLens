import { randomUUID } from 'node:crypto';

/**
 * Request-scoped context passed through to services.
 * Includes correlation ID for request tracing in logs.
 */
export interface RequestContext {
  correlationId: string;
}

/**
 * Create a new request context with a random correlation ID.
 */
export function createRequestContext(): RequestContext {
  return {
    correlationId: randomUUID()
  };
}
