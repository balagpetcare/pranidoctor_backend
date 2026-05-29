import type { Express } from 'express';
import helmet from 'helmet';

import type { AppConfig } from '../../config/config.schema.js';
import { sanitizeInputMiddleware } from './sanitize-input.middleware.js';
import { secureHeadersMiddleware } from './secure-headers.middleware.js';
import { createHelmetOptions } from './helmet.config.js';

/** Registers Phase 6 security middleware (helmet, headers, input sanitization). */
export function applySecurityMiddleware(app: Express, config: AppConfig): void {
  app.use(helmet(createHelmetOptions(config)));
  app.use(secureHeadersMiddleware());
  app.use(sanitizeInputMiddleware());
}
