import type { Request, Response, NextFunction } from 'express';

import { createRequestContext, runWithContext } from '../context/request-context.js';
import { omitUndefined } from '../types/object.utils.js';

export function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingRequestId = req.headers['x-request-id'];
  const existingTraceId = req.headers['x-trace-id'];

  const context = createRequestContext(
    omitUndefined({
      requestId: typeof existingRequestId === 'string' ? existingRequestId : undefined,
      traceId: typeof existingTraceId === 'string' ? existingTraceId : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip ?? req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    })
  );

  res.setHeader('X-Request-Id', context.requestId);
  res.setHeader('X-Trace-Id', context.traceId);

  runWithContext(context, () => {
    next();
  });
}
