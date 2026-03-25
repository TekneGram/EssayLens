import { appErr } from '../core/appResult';
import type { AppResult } from '../core/appResult';

export function notImplementedResult(operation: string): AppResult<never> {
  return appErr({
    code: 'NOT_IMPLEMENTED',
    userMessage: `${operation} is not implemented yet.`
  });
}
