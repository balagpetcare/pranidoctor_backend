/** Minimal Next.js server shim for legacy web route handlers on Express. */

class ResponseCookies {
  /** @param {Headers} headers */
  constructor(headers) {
    this.headers = headers;
  }

  /**
   * @param {string} name
   * @param {string} value
   * @param {{ httpOnly?: boolean; sameSite?: 'lax' | 'strict' | 'none'; path?: string; secure?: boolean; maxAge?: number }} [options]
   */
  set(name, value, options = {}) {
    const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];
    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.secure) parts.push('Secure');
    if (options.sameSite) {
      const ss =
        options.sameSite === 'none'
          ? 'None'
          : options.sameSite === 'strict'
            ? 'Strict'
            : 'Lax';
      parts.push(`SameSite=${ss}`);
    }
    this.headers.append('Set-Cookie', parts.join('; '));
  }
}

export class NextResponse extends Response {
  /** @param {ConstructorParameters<typeof Response>[0]} [body] @param {ResponseInit} [init] */
  constructor(body, init) {
    const headers = new Headers(init?.headers);
    super(body, { ...init, headers });
    this.cookies = new ResponseCookies(this.headers);
  }

  /** @param {unknown} body @param {ResponseInit} [init] */
  static json(body, init) {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }

  /** @param {string | URL} url @param {number | ResponseInit} [init] */
  static redirect(url, init) {
    const status = typeof init === 'number' ? init : (init?.status ?? 307);
    const headers =
      typeof init === 'object' && init !== null && 'headers' in init
        ? new Headers(/** @type {Record<string, string>} */ (init.headers))
        : new Headers();
    headers.set('location', String(url));
    return new NextResponse(null, { status, headers });
  }
}
