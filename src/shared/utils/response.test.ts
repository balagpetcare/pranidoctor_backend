import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { runWithContext, createRequestContext } from '../context/request-context.js';

import { apiResponse, sendSuccess } from './response.js';

describe('response wrapper', () => {
  it('builds foundation success envelope with requestId from context', () => {
    const ctx = createRequestContext({ requestId: 'req_test_123' });

    runWithContext(ctx, () => {
      const body = apiResponse({ id: '1' });
      expect(body).toEqual({
        success: true,
        data: { id: '1' },
        requestId: 'req_test_123',
      });
    });
  });

  it('sendSuccess writes foundation envelope to response', () => {
    const ctx = createRequestContext({ requestId: 'req_send_1' });
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status } as unknown as Response;

    runWithContext(ctx, () => {
      sendSuccess(res, { ok: true }, 201);
    });

    expect(status).toHaveBeenCalledWith(201);
    expect(json).toHaveBeenCalledWith({
      success: true,
      data: { ok: true },
      requestId: 'req_send_1',
    });
  });
});
