import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

import { getRequestId, getElapsedTime } from '../context/request-context.js';
import { logError, logWarn } from '../logger/logger.js';

import { AppError } from './app.error.js';
import { InternalServerError, ValidationError } from './http.errors.js';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getRequestId();
  const elapsed = getElapsedTime();

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      logError('Server error', error, {
        code: error.code,
        statusCode: error.statusCode,
        path: req.path,
        method: req.method,
        elapsed,
      });
    } else {
      logWarn('Client error', {
        code: error.code,
        statusCode: error.statusCode,
        message: error.message,
        path: req.path,
        method: req.method,
        elapsed,
      });
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
        ...(requestId && { requestId }),
      },
    };

    res.status(error.statusCode).json(response);
    return;
  }

  if (error instanceof ZodError) {
    const validationError = new ValidationError('VALIDATION_FAILED', 'Validation failed', {
      errors: formatZodError(error),
    });

    logWarn('Validation error', {
      path: req.path,
      method: req.method,
      errors: formatZodError(error),
      elapsed,
    });

    const response: ErrorResponse = {
      success: false,
      error: {
        code: validationError.code,
        message: validationError.message,
        details: validationError.details,
        ...(requestId && { requestId }),
      },
    };

    res.status(422).json(response);
    return;
  }

  logError('Unhandled error', error, {
    path: req.path,
    method: req.method,
    elapsed,
  });

  const internalError = new InternalServerError();

  const response: ErrorResponse = {
    success: false,
    error: {
      code: internalError.code,
      message: internalError.message,
      ...(requestId && { requestId }),
    },
  };

  res.status(500).json(response);
}

export function notFoundHandler(req: Request, res: Response): void {
  const requestId = getRequestId();

  logWarn('Route not found', {
    path: req.path,
    method: req.method,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      ...(requestId && { requestId }),
    },
  };

  res.status(404).json(response);
}
