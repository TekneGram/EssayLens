import type { AppError } from '@/app/result';

export function mapBackendError(raw: unknown): AppError {
  if (raw !== null && typeof raw === 'object' && 'code' in raw) {
    const code = String((raw as { code: unknown }).code);
    const message =
      'message' in raw ? String((raw as { message: unknown }).message) : 'An error occurred';
    return { code, message };
  }
  return { code: 'UNKNOWN', message: 'An unexpected error occurred' };
}
