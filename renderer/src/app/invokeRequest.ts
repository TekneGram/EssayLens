import type { AppResult } from '@/app/result';
import { mapBackendError } from '@/app/mapBackendError';

type WindowWithApi = Window & {
  api?: {
    invoke?: (channel: string, payload?: unknown) => Promise<{
      ok: boolean;
      data?: unknown;
      error?: unknown;
    }>;
  };
};

export async function invokeRequest<T>(
  channel: string,
  payload?: unknown
): Promise<AppResult<T>> {
  const appWindow = window as WindowWithApi;
  const raw = await appWindow.api?.invoke?.(channel, payload);
  if (!raw) {
    return { ok: false, error: mapBackendError(undefined) };
  }
  if (raw.ok) {
    return { ok: true, data: raw.data as T };
  }
  return { ok: false, error: mapBackendError(raw.error) };
}
