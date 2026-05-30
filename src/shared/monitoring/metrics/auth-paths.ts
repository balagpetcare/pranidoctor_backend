const AUTH_PATH_PATTERNS: Array<{ pattern: RegExp; surface: AuthSurface }> = [
  { pattern: /^\/api\/mobile\/auth\//, surface: 'mobile' },
  { pattern: /^\/api\/admin\/auth\//, surface: 'admin' },
  { pattern: /^\/api\/doctor\/auth\//, surface: 'doctor' },
  { pattern: /^\/api\/technician\/auth\//, surface: 'technician' },
  { pattern: /^\/api\/auth\//, surface: 'other' },
];

export type AuthSurface = 'mobile' | 'admin' | 'doctor' | 'technician' | 'other';

export function isAuthPath(rawPath: string): boolean {
  const path = rawPath.split('?')[0]?.trim() ?? '/';
  return AUTH_PATH_PATTERNS.some(({ pattern }) => pattern.test(path));
}

export function resolveAuthSurface(rawPath: string): AuthSurface {
  const path = rawPath.split('?')[0]?.trim() ?? '/';
  for (const { pattern, surface } of AUTH_PATH_PATTERNS) {
    if (pattern.test(path)) return surface;
  }
  return 'other';
}

/** Normalize HTTP status codes for Prometheus labels — bucket uncommon codes. */
export function normalizeStatusCode(statusCode: number): string {
  const common = new Set([
    200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504,
  ]);
  if (common.has(statusCode)) return String(statusCode);
  if (statusCode >= 500) return '5xx_other';
  if (statusCode >= 400) return '4xx_other';
  if (statusCode >= 300) return '3xx_other';
  if (statusCode >= 200) return '2xx_other';
  return 'unknown';
}
