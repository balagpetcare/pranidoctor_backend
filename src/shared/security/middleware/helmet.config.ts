import type { HelmetOptions } from 'helmet';

import type { AppConfig } from '../../config/config.schema.js';

/** Helmet options tuned per environment (API-only; no inline scripts). */
export function createHelmetOptions(config: AppConfig): HelmetOptions {
  const isProd = config.nodeEnv === 'production' || config.nodeEnv === 'staging';

  return {
    contentSecurityPolicy: isProd
      ? {
          directives: {
            defaultSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    hsts: isProd
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  };
}
