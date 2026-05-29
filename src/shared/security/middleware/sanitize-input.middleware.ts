import type { Request, Response, NextFunction, RequestHandler } from 'express';

const NULL_BYTE = /\0/g;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(NULL_BYTE, '').trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value as Record<string, unknown>);
  }
  return value;
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    out[key] = sanitizeValue(val);
  }
  return out;
}

/** Trims strings and strips null bytes from JSON body and query (light XSS hardening). */
export function sanitizeInputMiddleware(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body as Record<string, unknown>);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query as Record<string, unknown>) as typeof req.query;
    }
    next();
  };
}
