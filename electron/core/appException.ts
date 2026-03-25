import type { AppError } from './appError';

/**
 * Application exception that wraps an AppError.
 * Used to throw structured errors from services and handlers.
 */
export class AppException extends Error {
  constructor(public appError: AppError) {
    super(appError.userMessage);
    this.name = 'AppException';
  }
}

/**
 * Type guard to check if an error is an AppException.
 */
export function isAppException(error: unknown): error is AppException {
  return error instanceof AppException;
}
