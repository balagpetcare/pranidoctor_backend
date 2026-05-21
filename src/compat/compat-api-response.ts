import type { ApiErrorBody, ApiSuccess } from '../legacy/web/types/api.js';
import { NextResponse } from './next-server.js';

export function compatJsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true as const, data } satisfies ApiSuccess<T>, init);
}

export function compatJsonError(
  code: string,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      ok: false as const,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    } satisfies ApiErrorBody,
    { status },
  );
}
