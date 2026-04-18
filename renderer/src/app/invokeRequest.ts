import type { AppResult } from '@/app/result';
import { mapBackendError } from '@/app/mapBackendError';

type WindowWithApi = Window & {
  api?: {
    invoke?: (channel: string, payload?: unknown) => Promise<{
      ok: boolean;
      data?: unknown;
      error?: unknown;
    }>;
    [namespace: string]:
      | ((channel: string, payload?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: unknown }>)
      | Record<string, (payload?: unknown) => Promise<{ ok: boolean; data?: unknown; error?: unknown }>>
      | undefined;
  };
};

export async function invokeRequest<T>(
  channel: string,
  payload?: unknown
): Promise<AppResult<T>> {
  const appWindow = window as WindowWithApi;
  const raw = await invokeApiChannel(appWindow, channel, payload);
  if (!raw) {
    return { ok: false, error: mapBackendError(undefined) };
  }
  if (raw.ok) {
    return { ok: true, data: raw.data as T };
  }
  return { ok: false, error: mapBackendError(raw.error) };
}

async function invokeApiChannel(appWindow: WindowWithApi, channel: string, payload?: unknown) {
  const invoked = await appWindow.api?.invoke?.(channel, payload);
  if (invoked) {
    return invoked;
  }

  const [namespace, method] = channel.split('/');
  if (!namespace || !method) {
    return undefined;
  }

  const target = appWindow.api?.[namespace];
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  const handler = target[method];
  if (typeof handler !== 'function') {
    return undefined;
  }

  return payload === undefined ? await handler() : await handler(payload);
}
