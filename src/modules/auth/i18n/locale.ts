export type AuthLocale = 'bn-BD' | 'en-US';

export const DEFAULT_AUTH_LOCALE: AuthLocale = 'bn-BD';

const SUPPORTED = new Set<AuthLocale>(['bn-BD', 'en-US']);

/** Normalize tag to supported locale or null. */
export function normalizeLocaleTag(tag: string): AuthLocale | null {
  const t = tag.trim().toLowerCase();
  if (t === 'bn' || t === 'bn-bd') return 'bn-BD';
  if (t === 'en' || t === 'en-us') return 'en-US';
  return null;
}

/**
 * Parse Accept-Language (RFC 7231 subset): bn, en, bn-BD, en-US, optional q=.
 * Returns highest-q supported locale or null.
 */
export function parseAcceptLanguage(header: string | null | undefined): AuthLocale | null {
  if (!header?.trim()) return null;

  const entries: { locale: AuthLocale; q: number }[] = [];
  for (const part of header.split(',')) {
    const segment = part.trim();
    if (!segment) continue;
    const [tagRaw, ...params] = segment.split(';').map((s) => s.trim());
    const locale = normalizeLocaleTag(tagRaw ?? '');
    if (!locale) continue;
    let q = 1;
    for (const p of params) {
      if (p.toLowerCase().startsWith('q=')) {
        const parsed = Number.parseFloat(p.slice(2));
        if (!Number.isNaN(parsed)) q = parsed;
      }
    }
    entries.push({ locale, q });
  }

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.q - a.q);
  return entries[0]!.locale;
}

export function resolveLocale(
  acceptLanguage: string | null | undefined,
  profileLocale?: string | null,
): AuthLocale {
  const fromHeader = parseAcceptLanguage(acceptLanguage);
  if (fromHeader) return fromHeader;

  if (profileLocale) {
    const fromProfile = normalizeLocaleTag(profileLocale);
    if (fromProfile) return fromProfile;
  }

  return DEFAULT_AUTH_LOCALE;
}

export function resolveRequestLocale(
  request: Request,
  options?: { profileLocale?: string | null; forceLocale?: AuthLocale },
): AuthLocale {
  if (options?.forceLocale) return options.forceLocale;
  return resolveLocale(request.headers.get('accept-language'), options?.profileLocale);
}

export function isFrozenBnAuthPath(pathname: string): boolean {
  return (
    /\/api\/mobile\/auth\/otp\//.test(pathname) ||
    /\/api\/mobile\/auth\/(login|register)\/?$/.test(pathname) ||
    /\/api\/mobile\/auth\/(send-otp|verify-otp)\/?$/.test(pathname)
  );
}

export function contentLanguageHeader(locale: AuthLocale): Record<string, string> {
  return { 'Content-Language': locale };
}
