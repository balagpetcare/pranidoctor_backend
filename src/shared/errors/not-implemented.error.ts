import { AppError, type ErrorDetails } from './app.error.js';

export class NotImplementedError extends AppError {
  constructor(
    code = 'NOT_IMPLEMENTED',
    message = 'This foundation endpoint is not implemented yet',
    details?: ErrorDetails,
  ) {
    super(message, code, 501, details);
  }
}

export function throwFoundationNotImplemented(feature: string): never {
  throw new NotImplementedError(
    'NOT_IMPLEMENTED',
    `${feature} is not available on the foundation API. Use compat /api/mobile or /api/admin routes.`,
    { feature },
  );
}
