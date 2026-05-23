import type { Request, Response } from 'express';
import { describe, expect, it } from 'vitest';

import { expressToWebRequest } from './next-adapter.js';

function mockRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: Buffer;
}): Request {
  const headers = options.headers ?? {};
  const chunks = options.body ? [options.body] : [];
  let index = 0;

  const req = {
    method: options.method ?? 'POST',
    originalUrl: options.url ?? '/api/mobile/me/avatar',
    protocol: 'http',
    get(name: string) {
      if (name.toLowerCase() === 'host') return 'localhost:3000';
      return undefined;
    },
    headers,
    body: undefined,
    on(event: string, handler: (...args: unknown[]) => void) {
      if (event === 'data') {
        for (const chunk of chunks) handler(chunk);
      }
      if (event === 'end') handler();
      return req;
    },
  } as unknown as Request;

  return req;
}

describe('expressToWebRequest multipart', () => {
  it('preserves multipart raw body for formData parsing', async () => {
    const boundary = '----test';
    const payload = Buffer.from(
      `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="avatar"; filename="a.webp"\r\n' +
        'Content-Type: image/webp\r\n\r\n' +
        'fake-image-bytes\r\n' +
        `--${boundary}--\r\n`,
    );

    const req = mockRequest({
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      body: payload,
    });

    const webReq = await expressToWebRequest(req);
    const form = await webReq.formData();
    const file = form.get('avatar');

    expect(file).toBeInstanceOf(File);
    expect((file as File).size).toBeGreaterThan(0);
  });
});
