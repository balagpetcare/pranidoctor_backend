const UUID_PATTERN =
  /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const CUID_PATTERN = /\/c[a-z0-9]{24,}/gi;

/** Collapse dynamic path segments to limit Prometheus label cardinality. */
export function normalizeRoutePath(rawPath: string): string {
  let path = rawPath.split('?')[0]?.trim() ?? '/';
  if (!path.startsWith('/')) path = `/${path}`;

  path = path.replace(UUID_PATTERN, '/:id');
  path = path.replace(CUID_PATTERN, '/:id');
  path = path.replace(/\/\d+(?=\/|$)/g, '/:id');

  if (path.length > 120) {
    return path.slice(0, 117) + '...';
  }
  return path || '/';
}

export function statusClass(statusCode: number): string {
  if (statusCode <= 0) return 'unknown';
  return `${Math.floor(statusCode / 100)}xx`;
}

export function isProbePath(path: string): boolean {
  if (path === '/health' || path === '/live' || path === '/ready') return true;
  if (path === '/metrics' || path === '/metrics/json') return true;
  if (path.startsWith('/health/')) return true;
  return false;
}
