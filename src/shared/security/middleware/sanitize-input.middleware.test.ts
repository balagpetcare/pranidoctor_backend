import type { Request, Response, NextFunction } from 'express';
import { describe, expect, it, vi } from 'vitest';

import { sanitizeInputMiddleware } from './sanitize-input.middleware.js';

function runMiddleware(
  req: Partial<Request> & { query?: Record<string, unknown>; body?: unknown },
): void {
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  sanitizeInputMiddleware()(req as Request, res, next);
  expect(next).toHaveBeenCalledOnce();
}

describe('sanitizeInputMiddleware', () => {
  it('sanitizes query in place without reassigning req.query (Express 5)', () => {
    const query = { q: '  hello\0world  ', nested: { x: ' a\0b ' } };
    Object.defineProperty(query, 'locked', {
      value: true,
      enumerable: false,
    });

    const req: Partial<Request> = {};
    Object.defineProperty(req, 'query', {
      get: () => query,
      configurable: true,
    });

    runMiddleware(req);

    expect(query.q).toBe('helloworld');
    expect((query.nested as Record<string, string>).x).toBe('ab');
    expect(Object.getOwnPropertyDescriptor(req, 'query')?.set).toBeUndefined();
  });

  it('replaces body with a sanitized copy', () => {
    const req = {
      body: { name: '  test\0  ' },
      query: {},
    };

    runMiddleware(req);

    expect(req.body).toEqual({ name: 'test' });
  });
});
