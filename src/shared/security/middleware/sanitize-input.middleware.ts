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

/** Mutates in place — Express 5 exposes `req.query` as a read-only getter. */
function sanitizeInPlace(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = val.replace(NULL_BYTE, '').trim();
      continue;
    }
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const item = val[i];
        if (typeof item === 'string') {
          val[i] = item.replace(NULL_BYTE, '').trim();
        } else if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
          sanitizeInPlace(item as Record<string, unknown>);
        }
      }
      continue;
    }
    if (val !== null && typeof val === 'object') {
      sanitizeInPlace(val as Record<string, unknown>);
    }
  }
}

/** Trims strings and strips null bytes from JSON body and query (light XSS hardening). */
export function sanitizeInputMiddleware(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      req.body = sanitizeObject(req.body as Record<string, unknown>);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeInPlace(req.query as Record<string, unknown>);
    }
    next();
  };
}
