import type { AppError } from '@/app/result';

export class FrontAppError extends Error {
  constructor(public readonly appError: AppError) {
    super(appError.message);
  }
}
