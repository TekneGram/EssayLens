export interface AppError {
  code: string;
  message: string;
  details?: unknown;
}

export type AppResultSuccess<T> = {
  ok: true;
  data: T;
};

export type AppResultFailure<E extends AppError = AppError> = {
  ok: false;
  error: E;
};

export type AppResult<T, E extends AppError = AppError> = AppResultSuccess<T> | AppResultFailure<E>;

export function appOk<T>(data: T): AppResultSuccess<T> {
  return {
    ok: true,
    data
  };
}

export function appErr<E extends AppError>(error: E): AppResultFailure<E> {
  return {
    ok: false,
    error
  };
}

export function isAppResultSuccess<T, E extends AppError = AppError>(
  result: AppResult<T, E>
): result is AppResultSuccess<T> {
  return result.ok;
}

export function isAppResultFailure<T, E extends AppError = AppError>(
  result: AppResult<T, E>
): result is AppResultFailure<E> {
  return !result.ok;
}
