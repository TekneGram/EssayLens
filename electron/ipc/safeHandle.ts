import { AppException } from '../core/appException';
import { appOk, appErr } from '../core/appResult';
import { createRequestContext } from '../core/requestContext';
import type { RequestContext } from '../core/requestContext';
import type { IpcMainLike } from './types';

export function safeHandle<Req, Res>(
  ipc: IpcMainLike,
  channel: string,
  handler: (args: Req, ctx: RequestContext) => Promise<Res>
): void {
  ipc.handle(channel, async (_event, rawArgs) => {
    const ctx = createRequestContext();
    try {
      const result = await handler(rawArgs as Req, ctx);
      return appOk(result);
    } catch (error) {
      if (error instanceof AppException) {
        return appErr(error.appError);
      }
      return appErr({
        code: 'UNKNOWN',
        userMessage: 'An unexpected error occurred. Please try again.'
      });
    }
  });
}
