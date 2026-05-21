import type { Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' ? existingId : nanoid(21);

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  next();
}
