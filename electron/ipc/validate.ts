import type { ZodSchema } from 'zod';
import { AppException } from '../core/appException';
import type { AppError } from '../core/appError';

export function validateOrThrow<T>(schema: ZodSchema<T>, rawArgs: unknown): T {
  const result = schema.safeParse(rawArgs);
  if (!result.success) {
    const appError: AppError = {
      code: 'VALIDATION',
      userMessage: result.error.issues.map((i) => i.message).join('; ')
    };
    throw new AppException(appError);
  }
  return result.data;
}
