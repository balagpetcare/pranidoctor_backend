import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodSchema, ZodError } from 'zod';

import { ValidationError } from '../errors/http.errors.js';

export type ValidateTarget = 'body' | 'query' | 'params';

export interface ValidationOptions {
  stripUnknown?: boolean;
}

function formatZodErrors(error: ZodError): { field: string; message: string; code: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

export function validate(
  schema: ZodSchema,
  target: ValidateTarget = 'body',
  options: ValidationOptions = {}
): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data = req[target];

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const error = new ValidationError(
        'VALIDATION_FAILED',
        `Validation failed for ${target}`,
        { errors, target }
      );
      next(error);
      return;
    }

    if (options.stripUnknown !== false) {
      req[target] = result.data;
    }

    next();
  };
}

export function validateBody(schema: ZodSchema, options?: ValidationOptions): RequestHandler {
  return validate(schema, 'body', options);
}

export function validateQuery(schema: ZodSchema, options?: ValidationOptions): RequestHandler {
  return validate(schema, 'query', options);
}

export function validateParams(schema: ZodSchema, options?: ValidationOptions): RequestHandler {
  return validate(schema, 'params', options);
}

export function validateAll(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}): RequestHandler[] {
  const middlewares: RequestHandler[] = [];

  if (schemas.params) {
    middlewares.push(validateParams(schemas.params));
  }
  if (schemas.query) {
    middlewares.push(validateQuery(schemas.query));
  }
  if (schemas.body) {
    middlewares.push(validateBody(schemas.body));
  }

  return middlewares;
}
