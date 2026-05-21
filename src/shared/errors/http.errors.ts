import { AppError, type ErrorDetails } from './app.error.js';

export class BadRequestError extends AppError {
  constructor(code = 'BAD_REQUEST', message = 'Bad request', details?: ErrorDetails) {
    super(message, code, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(code = 'UNAUTHORIZED', message = 'Authentication required', details?: ErrorDetails) {
    super(message, code, 401, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(code = 'FORBIDDEN', message = 'Access denied', details?: ErrorDetails) {
    super(message, code, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(code = 'NOT_FOUND', message = 'Resource not found', details?: ErrorDetails) {
    super(message, code, 404, details);
  }
}

export class ConflictError extends AppError {
  constructor(code = 'CONFLICT', message = 'Resource conflict', details?: ErrorDetails) {
    super(message, code, 409, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    code = 'VALIDATION_FAILED',
    message = 'Validation failed',
    details?: ErrorDetails
  ) {
    super(message, code, 422, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    code = 'RATE_LIMIT_EXCEEDED',
    message = 'Too many requests',
    details?: ErrorDetails
  ) {
    super(message, code, 429, details);
  }
}

export class InternalServerError extends AppError {
  constructor(
    code = 'INTERNAL_ERROR',
    message = 'Internal server error',
    details?: ErrorDetails
  ) {
    super(message, code, 500, details, false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    code = 'SERVICE_UNAVAILABLE',
    message = 'Service temporarily unavailable',
    details?: ErrorDetails
  ) {
    super(message, code, 503, details);
  }
}
