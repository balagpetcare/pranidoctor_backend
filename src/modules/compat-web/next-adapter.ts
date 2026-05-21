import type { NextFunction, Request, Response as ExpressResponse } from 'express';

import { runWithExpressRequest } from '../../compat/next-headers.js';

type WebRouteHandler = (
  request: globalThis.Request,
  context?: { params: Promise<Record<string, string>> },
) => Promise<globalThis.Response> | globalThis.Response;

export function expressToWebRequest(req: Request): globalThis.Request {
  const host = req.get('host') ?? 'localhost';
  const protocol = req.protocol ?? 'http';
  const url = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD' && req.body !== undefined) {
    const body =
      typeof req.body === 'string'
        ? req.body
        : Buffer.isBuffer(req.body)
          ? req.body
          : JSON.stringify(req.body);
    init.body = body;
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  return new globalThis.Request(url, init);
}

export async function sendWebResponse(
  webRes: globalThis.Response,
  res: ExpressResponse,
): Promise<void> {
  res.status(webRes.status);
  webRes.headers.forEach((value: string, key: string) => {
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });
  const body = Buffer.from(await webRes.arrayBuffer());
  if (body.length > 0) {
    res.send(body);
  } else {
    res.end();
  }
}

export function wrapNextHandler(handler: WebRouteHandler) {
  return async (req: Request, res: ExpressResponse, next: NextFunction): Promise<void> => {
    try {
      const webReq = expressToWebRequest(req);
      const params: Record<string, string> = {};
      for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') params[key] = value;
      }
      const context = { params: Promise.resolve(params) };
      const webRes = await runWithExpressRequest(req, async () => handler(webReq, context));
      await sendWebResponse(webRes, res);
    } catch (error) {
      next(error);
    }
  };
}
