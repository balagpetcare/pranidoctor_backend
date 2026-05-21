/** Minimal Next.js server shim for legacy web route handlers on Express. */

type CookieSameSite = 'lax' | 'strict' | 'none';

export type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: CookieSameSite;
  path?: string;
  secure?: boolean;
  maxAge?: number;
};

class ResponseCookies {
  constructor(private readonly headers: Headers) {}

  set(name: string, value: string, options: CookieOptions = {}): void {
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
  readonly cookies: ResponseCookies;

  constructor(body?: ConstructorParameters<typeof Response>[0], init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    super(body, { ...init, headers });
    this.cookies = new ResponseCookies(this.headers);
  }

  static json(body: unknown, init?: ResponseInit): NextResponse {
    const headers = new Headers(init?.headers);
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    return new NextResponse(JSON.stringify(body), { ...init, headers });
  }

  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse {
    const status = typeof init === 'number' ? init : (init?.status ?? 307);
    const headers =
      typeof init === 'object' && init !== null && 'headers' in init
        ? new Headers(init.headers as Record<string, string>)
        : new Headers();
    headers.set('location', String(url));
    return new NextResponse(null, { status, headers });
  }
}
