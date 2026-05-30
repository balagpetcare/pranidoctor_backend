type CookieSameSite = 'lax' | 'strict' | 'none';

export type CookieOptions = {
  httpOnly?: boolean;
  sameSite?: CookieSameSite;
  path?: string;
  secure?: boolean;
  maxAge?: number;
};

export class NextResponse extends Response {
  readonly cookies: {
    set(name: string, value: string, options?: CookieOptions): void;
  };

  constructor(body?: ConstructorParameters<typeof Response>[0], init?: ResponseInit);

  static json(body: unknown, init?: ResponseInit): NextResponse;

  static redirect(url: string | URL, init?: number | ResponseInit): NextResponse;
}
