import type { ZodSchema } from 'zod';
import type { RequestHandler } from 'express';

import { validateBody } from '../../shared/validation/validate.middleware.js';

/** @deprecated Use `validateBody` from `@shared/validation` — kept for existing route files. */
export function createValidationMiddleware(schema: ZodSchema): RequestHandler {
  return validateBody(schema);
}
