/**
 * Standard error kinds for the backend.
 * These categories cover the main failure scenarios.
 */
export enum AppErrorKind {
  // Validation & input errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_PAYLOAD = 'INVALID_PAYLOAD',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Operation errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_IMPLEMENTED = 'NOT_IMPLEMENTED',

  // File/IO errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',

  // Service errors
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR'
}

/**
 * Structured application error.
 * Contains a standardized error code, user-facing message, and optional details.
 */
export interface AppError {
  code: AppErrorKind | string;
  userMessage: string;
  details?: unknown;
}

/**
 * Creates a structured AppError.
 */
export function createAppError(
  code: AppErrorKind | string,
  userMessage: string,
  details?: unknown
): AppError {
  return {
    code,
    userMessage,
    details
  };
}
