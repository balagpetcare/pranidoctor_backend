import type { ApiErrorBody, ApiSuccess } from '../types/api.js';

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ ok: true as const, data } satisfies ApiSuccess<T>, init);
}

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
  init?: ResponseInit,
): Response {
  return Response.json(
    {
      ok: false as const,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    } satisfies ApiErrorBody,
    { status, ...init },
  );
}
